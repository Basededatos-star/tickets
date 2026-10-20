'use strict';
/* DOKAN Tickets & Eventos — servidor
 * Node >= 22.5 (usa node:sqlite). Dependencias: sharp, qrcode, nodemailer.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;

// ---------- .env ----------
(function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();
const env = (k, d = '') => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);

const CFG = {
  port: Number(env('PORT', '3000')),
  publicUrl: env('PUBLIC_URL', `http://localhost:${env('PORT', '3000')}`).replace(/\/+$/, ''),
  adminUser: env('ADMIN_USER', 'admin'),
  adminPass: env('ADMIN_PASS', 'Dokan123'),
  cc: env('DEFAULT_COUNTRY_CODE', '502'),
  bank: {
    name: env('BANK_NAME', 'Banco (configura BANK_NAME)'),
    type: env('BANK_ACCOUNT_TYPE', 'Monetaria'),
    account: env('BANK_ACCOUNT', '0000000-0'),
    holder: env('BANK_HOLDER', 'Nombre del titular'),
  },
  wa: env('WHATSAPP_PROVIDER', 'none').toLowerCase(),
};

const { renderTicket, fmtDMY, fmtTime } = require('./lib/ticket');

// ---------- Datos ----------
const DATA = path.join(ROOT, 'data');
const TICKETS_DIR = path.join(DATA, 'tickets');
fs.mkdirSync(TICKETS_DIR, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'public', 'uploads'), { recursive: true });
const db = new DatabaseSync(path.join(DATA, 'dokan.db'));
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', verified INTEGER NOT NULL DEFAULT 0,
  code_hash TEXT, code_expires INTEGER, code_attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, subtitle TEXT, event_date TEXT NOT NULL, event_time TEXT NOT NULL,
  location TEXT NOT NULL, organizer TEXT NOT NULL, price REAL NOT NULL, poster TEXT, active INTEGER NOT NULL DEFAULT 1,
  next_number INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, event_id INTEGER NOT NULL,
  full_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, dpi TEXT NOT NULL, birth TEXT NOT NULL,
  qty INTEGER NOT NULL, total REAL NOT NULL, status TEXT NOT NULL DEFAULT 'solicitada',
  auth_number TEXT, reject_reason TEXT, email_status TEXT, wa_status TEXT, wa_link TEXT,
  created_at INTEGER NOT NULL, paid_at INTEGER, decided_at INTEGER);
CREATE TABLE IF NOT EXISTS tickets(
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, event_id INTEGER NOT NULL, number INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE, holder_name TEXT NOT NULL, holder_birth TEXT NOT NULL, holder_dpi TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0, used_at INTEGER, created_at INTEGER NOT NULL);
`);

const now = () => Date.now();
const rand = (n) => crypto.randomBytes(n).toString('hex');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hashPw = (pw) => { const salt = rand(16); return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`; };
const checkPw = (pw, stored) => {
  const [salt, h] = String(stored).split(':');
  const x = crypto.scryptSync(pw, salt, 64);
  const y = Buffer.from(h, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Seed: admin y evento de ejemplo
if (!db.prepare('SELECT 1 FROM users WHERE role = ?').get('admin')) {
  db.prepare('INSERT INTO users(name,email,phone,password_hash,role,verified,created_at) VALUES(?,?,?,?,?,1,?)')
    .run('Administrador', CFG.adminUser.toLowerCase(), '', hashPw(CFG.adminPass), 'admin', now());
  console.log(`[seed] Usuario admin creado: ${CFG.adminUser}`);
}
if (!db.prepare('SELECT 1 FROM events').get()) {
  db.prepare('INSERT INTO events(title,subtitle,event_date,event_time,location,organizer,price,poster) VALUES(?,?,?,?,?,?,?,?)')
    .run('Amateur Fight League', 'Sexta Edición', '2026-11-28', '18:00', 'Antigua Guatemala', 'Sensei Raul Mazariegos', 200, '/img/poster.jpg');
  console.log('[seed] Evento de ejemplo creado');
}

// ---------- Correo ----------
let mailer = null;
function getMailer() {
  if (mailer !== null) return mailer;
  if (!env('SMTP_HOST')) return (mailer = false);
  try {
    const nodemailer = require('nodemailer');
    const port = Number(env('SMTP_PORT', '465'));
    mailer = nodemailer.createTransport({
      host: env('SMTP_HOST'), port, secure: port === 465,
      auth: env('SMTP_USER') ? { user: env('SMTP_USER'), pass: env('SMTP_PASS') } : undefined,
    });
  } catch (e) { console.error('[correo] nodemailer no disponible:', e.message); mailer = false; }
  return mailer;
}
async function sendMail({ to, subject, text, html, attachments }) {
  const m = getMailer();
  if (!m) {
    const line = `[correo simulado] Para: ${to} | Asunto: ${subject}\n${text}\n${(attachments || []).map((a) => `  adjunto: ${a.filename}`).join('\n')}\n---\n`;
    console.log(line);
    fs.appendFileSync(path.join(DATA, 'outbox.log'), `${new Date().toISOString()} ${line}`);
    return { ok: true, simulated: true };
  }
  try {
    await m.sendMail({ from: env('SMTP_FROM', env('SMTP_USER')), to, subject, text, html, attachments });
    return { ok: true };
  } catch (e) { console.error('[correo] error:', e.message); return { ok: false, error: e.message }; }
}

// ---------- WhatsApp ----------
function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 8) d = CFG.cc + d;
  return d;
}
async function sendWhatsApp(phone, text, mediaUrl) {
  const to = normPhone(phone);
  const link = `https://wa.me/${to}?text=${encodeURIComponent(`${text}${mediaUrl ? `\n${mediaUrl}` : ''}`)}`;
  try {
    if (CFG.wa === 'twilio' && env('TWILIO_SID')) {
      const body = new URLSearchParams({ To: `whatsapp:+${to}`, From: env('TWILIO_FROM'), Body: text });
      if (mediaUrl) body.append('MediaUrl', mediaUrl);
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env('TWILIO_SID')}/Messages.json`, {
        method: 'POST', body,
        headers: { Authorization: 'Basic ' + Buffer.from(`${env('TWILIO_SID')}:${env('TWILIO_TOKEN')}`).toString('base64') },
      });
      if (!r.ok) throw new Error(`Twilio ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return { ok: true, mode: 'twilio', link };
    }
    if (CFG.wa === 'meta' && env('META_TOKEN')) {
      const payload = mediaUrl
        ? { messaging_product: 'whatsapp', to, type: 'image', image: { link: mediaUrl, caption: text } }
        : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } };
      const r = await fetch(`https://graph.facebook.com/v20.0/${env('META_PHONE_ID')}/messages`, {
        method: 'POST', body: JSON.stringify(payload),
        headers: { Authorization: `Bearer ${env('META_TOKEN')}`, 'Content-Type': 'application/json' },
      });
      if (!r.ok) throw new Error(`Meta ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return { ok: true, mode: 'meta', link };
    }
  } catch (e) { console.error('[whatsapp] error:', e.message); return { ok: false, mode: CFG.wa, error: e.message, link }; }
  console.log(`[whatsapp manual] ${to}: ${text} ${mediaUrl || ''}`);
  return { ok: true, mode: 'manual', link };
}

// ---------- Utilidades HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const send = (res, status, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
};
class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }
const bad = (msg, extra) => new HttpError(400, msg, extra);

function readBody(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Solicitud demasiado grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(bad('JSON inválido')); }
    });
    req.on('error', reject);
  });
}
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setSession(res, userId) {
  const token = rand(32);
  db.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').run(token, userId, now() + 7 * 864e5);
  const secure = CFG.publicUrl.startsWith('https') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 86400}${secure}`);
}
function getUser(req) {
  const t = parseCookies(req).sid;
  if (!t) return null;
  const s = db.prepare('SELECT user_id, expires FROM sessions WHERE token = ?').get(t);
  if (!s || s.expires < now()) return null;
  return db.prepare('SELECT id,name,email,phone,role,verified FROM users WHERE id = ?').get(s.user_id) || null;
}
// Límite simple de intentos por IP+clave
const hits = new Map();
function throttle(key, max, windowMs) {
  const t = now(); const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
  if (arr.length >= max) throw new HttpError(429, 'Demasiados intentos, espera unos minutos.');
  arr.push(t); hits.set(key, arr);
}

// ---------- Validaciones ----------
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 120;
const cleanStr = (s, max = 120) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === s && d.getUTCFullYear() >= 1920 && d.getTime() < Date.now();
}
const money = (n) => `Q${Number(n).toFixed(2)}`;

// ---------- Códigos de verificación ----------
async function issueCode(user) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  db.prepare('UPDATE users SET code_hash=?, code_expires=?, code_attempts=0 WHERE id=?').run(sha(code + user.email), now() + 15 * 60e3, user.id);
  const r = await sendMail({
    to: user.email,
    subject: `Tu código de verificación DOKAN: ${code}`,
    text: `Hola ${user.name},\n\nTu código de verificación es: ${code}\nVence en 15 minutos.\n\nSi no creaste esta cuenta, ignora este mensaje.\n— DOKAN Tickets & Eventos`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#06122b;color:#fff;padding:28px;border-radius:12px">
      <h2 style="margin:0 0 8px">DOKAN <span style="color:#1677ff">Tickets</span></h2><p>Hola ${user.name.replace(/[<>&]/g, '')}, tu código de verificación es:</p>
      <p style="font-size:36px;letter-spacing:8px;font-weight:700;background:#0b1f4a;padding:14px;text-align:center;border-radius:8px">${code}</p>
      <p style="color:#9db4e8;font-size:13px">Vence en 15 minutos. Si no creaste esta cuenta, ignora este mensaje.</p></div>`,
  });
  return r;
}

// ---------- Emisión de boletos ----------
const ticketFile = (code) => path.join(TICKETS_DIR, `${code}.png`);
const ticketNumber = (n) => String(n).padStart(3, '0');

async function approveOrder(orderId) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!o) throw new HttpError(404, 'Solicitud no encontrada');
  if (o.status !== 'por_validar') throw bad('Solo se pueden autorizar solicitudes con transferencia reportada.');
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(o.event_id);

  const created = [];
  db.exec('BEGIN IMMEDIATE');
  try {
    const cur = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    if (cur.status !== 'por_validar') throw bad('La solicitud ya fue procesada.');
    for (let i = 0; i < o.qty; i++) {
      const fresh = db.prepare('SELECT next_number FROM events WHERE id = ?').get(ev.id);
      db.prepare('UPDATE events SET next_number = next_number + 1 WHERE id = ?').run(ev.id);
      const code = rand(16);
      db.prepare('INSERT INTO tickets(order_id,event_id,number,code,holder_name,holder_birth,holder_dpi,created_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(o.id, ev.id, fresh.next_number, code, o.full_name, o.birth, o.dpi, now());
      created.push({ number: fresh.next_number, code });
    }
    db.prepare("UPDATE orders SET status='aprobada', decided_at=? WHERE id=?").run(now(), o.id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }

  // Imágenes
  const files = [];
  try {
    for (const t of created) {
      const png = await renderTicket({ number: ticketNumber(t.number), name: o.full_name, birth: o.birth, dpi: o.dpi, code: t.code, event: ev }, ROOT);
      fs.writeFileSync(ticketFile(t.code), png);
      files.push({ filename: `Boleto-${ticketNumber(t.number)}-DOKAN.png`, path: ticketFile(t.code), code: t.code, number: t.number });
    }
  } catch (e) {
    console.error('[boleto] error generando imagen:', e);
    db.exec('BEGIN');
    db.prepare('DELETE FROM tickets WHERE order_id = ?').run(o.id);
    db.prepare("UPDATE orders SET status='por_validar', decided_at=NULL WHERE id=?").run(o.id);
    db.exec('COMMIT');
    throw new HttpError(500, 'No se pudo generar el boleto: ' + e.message);
  }

  // Correo
  const list = files.map((f) => `#${ticketNumber(f.number)}`).join(', ');
  const mail = await sendMail({
    to: o.email,
    subject: `Tus boletos para ${ev.title} ${ev.subtitle || ''} ✔`.trim(),
    text: `Hola ${o.full_name},\n\nTu transferencia fue validada. Adjuntamos tu${files.length > 1 ? 's' : ''} boleto${files.length > 1 ? 's' : ''} (${list}) para ${ev.title}.\nFecha: ${fmtDMY(ev.event_date)} ${fmtTime(ev.event_time)}\nLugar: ${ev.location}\n\nPresenta el código QR en la entrada.\n— DOKAN Tickets & Eventos`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>¡Pago confirmado!</h2><p>Hola <b>${o.full_name.replace(/[<>&]/g, '')}</b>, tu transferencia fue validada. Tus boletos (${list}) van adjuntos.</p>
      <p><b>${ev.title}</b> ${ev.subtitle || ''}<br>${fmtDMY(ev.event_date)} · ${fmtTime(ev.event_time)}<br>${ev.location}</p><p>Presenta el código QR en la entrada.</p></div>`,
    attachments: files.map((f) => ({ filename: f.filename, path: f.path })),
  });

  // WhatsApp (un mensaje por boleto)
  const waResults = [];
  for (const f of files) {
    const url = `${CFG.publicUrl}/t/${f.code}.png`;
    const text = `¡Hola ${o.full_name}! Tu pago fue confirmado ✅\nBoleto #${ticketNumber(f.number)} — ${ev.title} ${ev.subtitle || ''}\n${fmtDMY(ev.event_date)} · ${fmtTime(ev.event_time)} · ${ev.location}\nPresenta este QR en la entrada.`;
    waResults.push(await sendWhatsApp(o.phone, text, url));
  }
  const waOk = waResults.every((r) => r.ok);
  const waMode = waResults[0]?.mode || 'manual';
  db.prepare('UPDATE orders SET email_status=?, wa_status=?, wa_link=? WHERE id=?').run(
    mail.ok ? (mail.simulated ? 'simulado' : 'enviado') : `error: ${mail.error}`,
    waOk ? (waMode === 'manual' ? 'manual' : 'enviado') : `error: ${waResults.find((r) => !r.ok)?.error}`,
    waResults[0]?.link || null, o.id);
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id);
}

// ---------- Presentación ----------
function publicEvent(e) {
  return { id: e.id, title: e.title, subtitle: e.subtitle, event_date: e.event_date, event_time: e.event_time, location: e.location, organizer: e.organizer, price: e.price, poster: e.poster, active: !!e.active };
}
function orderView(o, { admin = false } = {}) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(o.event_id);
  const tickets = db.prepare('SELECT number, code, used FROM tickets WHERE order_id = ? ORDER BY number').all(o.id)
    .map((t) => ({ number: ticketNumber(t.number), url: `/t/${t.code}.png`, used: !!t.used }));
  const v = {
    id: o.id, event: ev ? publicEvent(ev) : null, full_name: o.full_name, email: o.email, phone: o.phone, dpi: o.dpi, birth: o.birth,
    qty: o.qty, total: o.total, status: o.status, auth_number: o.auth_number, reject_reason: o.reject_reason, created_at: o.created_at, paid_at: o.paid_at,
    tickets: o.status === 'aprobada' ? tickets : [],
  };
  if (admin) {
    v.account_email = db.prepare('SELECT email FROM users WHERE id = ?').get(o.user_id)?.email;
    v.email_status = o.email_status; v.wa_status = o.wa_status; v.wa_link = o.wa_link;
  }
  return v;
}

// ---------- Rutas ----------
const routes = [];
const route = (method, pattern, opts, handler) => {
  if (typeof opts === 'function') { handler = opts; opts = {}; }
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, opts, handler });
};

// Sesión
route('GET', '/api/me', (c) => ({ user: c.user }));
route('GET', '/api/config', () => ({ bank: CFG.bank, waMode: CFG.wa }));
route('POST', '/api/logout', (c) => {
  const t = parseCookies(c.req).sid;
  if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(t);
  c.res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
  return { ok: true };
});

route('POST', '/api/register', async (c) => {
  throttle(`reg:${c.ip}`, 10, 15 * 60e3);
  const name = cleanStr(c.body.name, 80), email = cleanStr(c.body.email).toLowerCase(), phone = normPhone(c.body.phone), pw = String(c.body.password || '');
  if (name.length < 3) throw bad('Escribe tu nombre completo.');
  if (!isEmail(email)) throw bad('Correo electrónico inválido.');
  if (phone.length < 10 || phone.length > 15) throw bad('Teléfono inválido (ej. 5555-5555).');
  if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw bad('La contraseña debe tener 8+ caracteres con letras y números.');
  const ex = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  let user;
  if (ex && ex.verified) throw new HttpError(409, 'Ya existe una cuenta con ese correo. Inicia sesión.');
  if (ex) {
    db.prepare('UPDATE users SET name=?, phone=?, password_hash=? WHERE id=?').run(name, phone, hashPw(pw), ex.id);
    user = { ...ex, name, email };
  } else {
    const r = db.prepare('INSERT INTO users(name,email,phone,password_hash,created_at) VALUES(?,?,?,?,?)').run(name, email, phone, hashPw(pw), now());
    user = { id: Number(r.lastInsertRowid), name, email };
  }
  await issueCode(user);
  return { ok: true, needsVerification: true, email };
});

route('POST', '/api/resend', async (c) => {
  const email = cleanStr(c.body.email).toLowerCase();
  throttle(`resend:${email}`, 4, 15 * 60e3);
  const u = db.prepare('SELECT * FROM users WHERE email = ? AND verified = 0').get(email);
  if (u) await issueCode(u);
  return { ok: true };
});

route('POST', '/api/verify', (c) => {
  const email = cleanStr(c.body.email).toLowerCase(), code = String(c.body.code || '').replace(/\D/g, '');
  throttle(`ver:${c.ip}`, 20, 15 * 60e3);
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!u || !u.code_hash) throw bad('Código inválido.');
  if (u.code_attempts >= 5) throw new HttpError(429, 'Demasiados intentos. Solicita un código nuevo.');
  if (u.code_expires < now()) throw bad('El código venció. Solicita uno nuevo.');
  db.prepare('UPDATE users SET code_attempts = code_attempts + 1 WHERE id = ?').run(u.id);
  if (sha(code + email) !== u.code_hash) throw bad('Código incorrecto.');
  db.prepare('UPDATE users SET verified=1, code_hash=NULL, code_expires=NULL, code_attempts=0 WHERE id=?').run(u.id);
  setSession(c.res, u.id);
  return { ok: true };
});

route('POST', '/api/login', (c) => {
  const id = cleanStr(c.body.email).toLowerCase(), pw = String(c.body.password || '');
  throttle(`login:${c.ip}`, 15, 10 * 60e3);
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(id);
  if (!u || !checkPw(pw, u.password_hash)) throw new HttpError(401, 'Usuario o contraseña incorrectos.');
  if (!u.verified) throw new HttpError(403, 'Debes verificar tu correo.', { needsVerification: true, email: u.email });
  setSession(c.res, u.id);
  return { ok: true, role: u.role };
});

route('POST', '/api/password', { auth: true }, (c) => {
  const cur = String(c.body.current || ''), nw = String(c.body.password || '');
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(c.user.id);
  if (!checkPw(cur, u.password_hash)) throw bad('La contraseña actual no es correcta.');
  if (nw.length < 8 || !/[A-Za-z]/.test(nw) || !/\d/.test(nw)) throw bad('La nueva contraseña debe tener 8+ caracteres con letras y números.');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPw(nw), u.id);
  return { ok: true };
});

// Eventos
route('GET', '/api/events', { auth: true }, () => ({ events: db.prepare('SELECT * FROM events WHERE active = 1 ORDER BY event_date').all().map(publicEvent) }));
route('GET', '/api/events/:id', { auth: true }, (c) => {
  const e = db.prepare('SELECT * FROM events WHERE id = ? AND active = 1').get(c.params.id);
  if (!e) throw new HttpError(404, 'Evento no encontrado');
  return { event: publicEvent(e) };
});

// Solicitudes del cliente
route('POST', '/api/orders', { auth: true }, (c) => {
  if (c.user.role === 'admin') throw bad('El administrador no puede solicitar entradas.');
  const b = c.body;
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND active = 1').get(Number(b.event_id));
  if (!ev) throw new HttpError(404, 'Evento no disponible');
  const full_name = cleanStr(b.full_name, 80), email = cleanStr(b.email).toLowerCase(), phone = normPhone(b.phone);
  const dpi = String(b.dpi || '').replace(/\D/g, ''), birth = String(b.birth || ''), qty = Number(b.qty);
  if (full_name.length < 3) throw bad('Escribe tu nombre completo.');
  if (!isEmail(email)) throw bad('Correo electrónico inválido.');
  if (phone.length < 10 || phone.length > 15) throw bad('Teléfono inválido.');
  if (dpi.length !== 13) throw bad('El DPI debe tener 13 dígitos.');
  if (!validDate(birth)) throw bad('Fecha de nacimiento inválida.');
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw bad('La cantidad debe ser de 1 a 10 entradas.');
  const open = db.prepare("SELECT COUNT(*) n FROM orders WHERE user_id = ? AND status IN ('solicitada','por_validar')").get(c.user.id).n;
  if (open >= 5) throw bad('Tienes demasiadas solicitudes pendientes. Espera a que se validen.');
  const r = db.prepare('INSERT INTO orders(user_id,event_id,full_name,email,phone,dpi,birth,qty,total,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(c.user.id, ev.id, full_name, email, phone, dpi, birth, qty, ev.price * qty, now());
  return { ok: true, id: Number(r.lastInsertRowid) };
});
route('GET', '/api/orders', { auth: true }, (c) => ({
  orders: db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(c.user.id).map((o) => orderView(o)),
}));
route('GET', '/api/orders/:id', { auth: true }, (c) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(c.params.id, c.user.id);
  if (!o) throw new HttpError(404, 'Solicitud no encontrada');
  return { order: orderView(o) };
});
route('POST', '/api/orders/:id/payment', { auth: true }, (c) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(c.params.id, c.user.id);
  if (!o) throw new HttpError(404, 'Solicitud no encontrada');
  if (!['solicitada', 'por_validar'].includes(o.status)) throw bad('Esta solicitud ya fue procesada.');
  const auth = cleanStr(c.body.auth_number, 40).replace(/\s/g, '');
  if (!/^[A-Za-z0-9-]{4,40}$/.test(auth)) throw bad('Escribe el número de autorización/boleta de la transferencia (4 a 40 caracteres).');
  const dup = db.prepare("SELECT 1 FROM orders WHERE auth_number = ? AND id != ? AND status IN ('por_validar','aprobada')").get(auth, o.id);
  if (dup) throw bad('Ese número de autorización ya fue utilizado en otra solicitud.');
  db.prepare("UPDATE orders SET auth_number=?, status='por_validar', paid_at=?, reject_reason=NULL WHERE id=?").run(auth, now(), o.id);
  return { ok: true };
});
route('DELETE', '/api/orders/:id', { auth: true }, (c) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(c.params.id, c.user.id);
  if (!o) throw new HttpError(404, 'Solicitud no encontrada');
  if (o.status !== 'solicitada') throw bad('Solo se pueden cancelar solicitudes sin transferencia reportada.');
  db.prepare("UPDATE orders SET status='cancelada', decided_at=? WHERE id=?").run(now(), o.id);
  return { ok: true };
});

// Admin
route('GET', '/api/admin/orders', { admin: true }, (c) => {
  const st = c.url.searchParams.get('status');
  const rows = st ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC').all(st) : db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  return { orders: rows.map((o) => orderView(o, { admin: true })) };
});
route('POST', '/api/admin/orders/:id/approve', { admin: true }, async (c) => {
  const o = await approveOrder(Number(c.params.id));
  return { ok: true, order: orderView(o, { admin: true }) };
});
route('POST', '/api/admin/orders/:id/reject', { admin: true }, (c) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(c.params.id);
  if (!o) throw new HttpError(404, 'Solicitud no encontrada');
  if (o.status !== 'por_validar') throw bad('Solo se pueden rechazar solicitudes por validar.');
  db.prepare("UPDATE orders SET status='rechazada', reject_reason=?, decided_at=? WHERE id=?").run(cleanStr(c.body.reason, 200) || 'La transferencia no pudo ser validada.', now(), o.id);
  return { ok: true };
});
route('GET', '/api/admin/stats', { admin: true }, () => {
  const n = (q, ...a) => db.prepare(q).get(...a).n;
  return {
    por_validar: n("SELECT COUNT(*) n FROM orders WHERE status='por_validar'"),
    aprobadas: n("SELECT COUNT(*) n FROM orders WHERE status='aprobada'"),
    boletos: n('SELECT COUNT(*) n FROM tickets'),
    ingresados: n('SELECT COUNT(*) n FROM tickets WHERE used=1'),
    recaudado: db.prepare("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status='aprobada'").get().n,
  };
});
route('GET', '/api/admin/events', { admin: true }, () => ({ events: db.prepare('SELECT * FROM events ORDER BY id DESC').all().map(publicEvent) }));
route('POST', '/api/admin/events', { admin: true, limit: 8 * 1024 * 1024 }, async (c) => {
  const b = c.body;
  const title = cleanStr(b.title, 80), subtitle = cleanStr(b.subtitle, 80), location = cleanStr(b.location, 100), organizer = cleanStr(b.organizer, 80);
  const date = String(b.event_date || ''), time = String(b.event_time || ''), price = Number(b.price);
  if (!title || !location || !organizer) throw bad('Completa título, lugar y organizador.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw bad('Fecha u hora inválida.');
  if (!(price > 0 && price < 100000)) throw bad('Precio inválido.');
  let poster = '/img/poster.jpg';
  if (b.image_data) {
    const m = String(b.image_data).match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
    if (!m) throw bad('Imagen inválida (usa PNG, JPG o WEBP).');
    const sharp = require('sharp');
    const name = `ev-${rand(6)}.jpg`;
    await sharp(Buffer.from(m[2], 'base64')).resize(1066, 810, { fit: 'cover' }).jpeg({ quality: 90 }).toFile(path.join(ROOT, 'public', 'uploads', name));
    poster = `/uploads/${name}`;
  }
  const r = db.prepare('INSERT INTO events(title,subtitle,event_date,event_time,location,organizer,price,poster) VALUES(?,?,?,?,?,?,?,?)')
    .run(title, subtitle, date, time, location, organizer, price, poster);
  return { ok: true, id: Number(r.lastInsertRowid) };
});
route('POST', '/api/admin/events/:id/toggle', { admin: true }, (c) => {
  db.prepare('UPDATE events SET active = 1 - active WHERE id = ?').run(c.params.id);
  return { ok: true };
});

// Escáner
function ticketInfo(code) {
  const t = db.prepare('SELECT * FROM tickets WHERE code = ?').get(code);
  if (!t) return null;
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(t.event_id);
  return {
    number: ticketNumber(t.number), name: t.holder_name, birth: fmtDMY(t.holder_birth), dpi: t.holder_dpi,
    event: `${ev.title} ${ev.subtitle || ''}`.trim(), date: fmtDMY(ev.event_date), time: fmtTime(ev.event_time), location: ev.location,
    organizer: ev.organizer, used: !!t.used, used_at: t.used_at,
  };
}
const codeFrom = (raw) => String(raw || '').trim().replace(/^DOKAN\|/i, '').toLowerCase();
route('POST', '/api/admin/scan', { admin: true }, (c) => {
  const code = codeFrom(c.body.code);
  if (!/^[a-f0-9]{32}$/.test(code)) return { valid: false, reason: 'Código QR no reconocido.' };
  const info = ticketInfo(code);
  if (!info) return { valid: false, reason: 'Boleto no encontrado. Posible falsificación.' };
  return { valid: true, ticket: info };
});
route('POST', '/api/admin/checkin', { admin: true }, (c) => {
  const code = codeFrom(c.body.code);
  const r = db.prepare('UPDATE tickets SET used=1, used_at=? WHERE code=? AND used=0').run(now(), code);
  if (!r.changes) throw bad('Este boleto ya fue utilizado o no existe.');
  return { ok: true, ticket: ticketInfo(code) };
});

// ---------- Servidor ----------
function serveFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=300' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  try {
    // Boleto público (enlace imposible de adivinar; WhatsApp lo descarga desde aquí)
    let m = p.match(/^\/t\/([a-f0-9]{32})\.png$/);
    if (m) {
      const f = ticketFile(m[1]);
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end('No encontrado'); }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600', 'Content-Disposition': `inline; filename="boleto-dokan.png"` });
      return fs.createReadStream(f).pipe(res);
    }
    if (p.startsWith('/api/')) {
      const r = routes.find((x) => x.method === req.method && x.re.test(p));
      if (!r) return send(res, 404, { error: 'Ruta no encontrada' });
      const vals = p.match(r.re).slice(1);
      const params = Object.fromEntries(r.keys.map((k, i) => [k, vals[i]]));
      const user = getUser(req);
      if ((r.opts.auth || r.opts.admin) && !user) return send(res, 401, { error: 'Inicia sesión para continuar.' });
      if (r.opts.admin && user.role !== 'admin') return send(res, 403, { error: 'Acceso solo para administradores.' });
      const body = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req, r.opts.limit) : {};
      const ip = req.socket.remoteAddress;
      const out = await r.handler({ req, res, url, params, body, user, ip });
      return send(res, 200, out);
    }
    // Estáticos
    let rel = p === '/' ? '/index.html' : p;
    const file = path.normalize(path.join(ROOT, 'public', rel));
    if (!file.startsWith(path.join(ROOT, 'public') + path.sep)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return serveFile(res, file);
    return serveFile(res, path.join(ROOT, 'public', 'index.html'));
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...(e.extra || {}) });
    console.error('[error]', e);
    send(res, 500, { error: 'Error interno del servidor' });
  }
});

server.listen(CFG.port, () => {
  console.log(`\n  DOKAN Tickets listo → ${CFG.publicUrl}`);
  console.log(`  Admin: ${CFG.adminUser} / (contraseña definida en ADMIN_PASS)`);
  console.log(`  Correo: ${env('SMTP_HOST') ? 'SMTP ' + env('SMTP_HOST') : 'SIMULADO (consola + data/outbox.log)'} · WhatsApp: ${CFG.wa}\n`);
});
