'use strict';
/* DOKAN Tickets — interfaz (SPA con rutas por hash) */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const S = { user: null, cfg: null };

const I = {
  home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 12h3v8h5v-6h4v6h5v-8h3z"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z"/><path d="M9 9h6M9 15h6"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>',
  id: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.5 1.7-2 3-2s2.500.5 3 2M14 10h4M14 14h4"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.500A2.500 2.500 0 1 1 12 6.500a2.500 2.500 0 0 1 0 5z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.500 3-6 7-6s7 2.500 7 6z"/><circle cx="17" cy="9" r="2.500"/><path d="M17 14c3 0 5 1.800 5 4.500V20h-4"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21 23 12 2 3v7l15 2-15 2z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.5"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="10" rx="1.500"/><rect x="13" y="3" width="8" height="6" rx="1.500"/><rect x="13" y="11" width="8" height="10" rx="1.500"/><rect x="3" y="15" width="8" height="6" rx="1.500"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/></svg>',
  cal2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 14v4M10 16h4"/></svg>',
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${y}`; };
const fTime = (t) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'p.m.' : 'a.m.'}`; };
const money = (n) => `Q${Number(n).toFixed(2)}`;
const fStamp = (ms) => new Date(ms).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
const STATUS = { solicitada: 'Pendiente de pago', por_validar: 'En revisión', aprobada: 'Aprobada', rechazada: 'Rechazada', cancelada: 'Cancelada' };
const badge = (s) => `<span class="badge b-${s}">${STATUS[s] || s}</span>`;

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  let data = {};
  try { data = await r.json(); } catch { /* vacío */ }
  if (!r.ok) { const e = new Error(data.error || 'Error de conexión'); e.status = r.status; e.data = data; throw e; }
  return data;
}
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.textContent = msg;
  $('#toasts').append(el); setTimeout(() => el.remove(), 5500);
}
async function busy(btn, fn) {
  const html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = html; }
}
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };

/* ---------- Shell ---------- */
function brand() { return '<div class="brand"><div class="logo"><b>D</b>OKAN</div><div class="logo-sub">Tickets &amp; Eventos</div></div>'; }
function shell(active, inner) {
  const admin = S.user.role === 'admin';
  const items = admin
    ? [['#/admin', 'dash', 'Panel'], ['#/admin/solicitudes', 'doc', 'Solicitudes'], ['#/admin/eventos', 'cal2', 'Eventos'], ['#/admin/escaner', 'scan', 'Escáner QR'], ['#/perfil', 'user', 'Perfil y seguridad']]
    : [['#/', 'home', 'Inicio'], ['#/eventos', 'ticket', 'Solicitar entradas'], ['#/mis-solicitudes', 'doc', 'Mi solicitud'], ['#/perfil', 'user', 'Perfil y seguridad']];
  app.innerHTML = `<div class="shell">
    <aside class="side">${brand()}
      <nav class="nav">${items.map(([h, ic, t]) => `<a href="${h}" class="${active === h ? 'active' : ''}">${I[ic]}<span>${t}</span></a>`).join('')}</nav>
      <div class="tag">Tu acceso<br>a los mejores<br>eventos.<i></i></div>
    </aside>
    <div class="main">
      <div class="top"><button class="userbtn" id="ubtn"><span>${esc(S.user.name)}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg><span class="avatar">${I.user}</span></button>
        <div class="menu hidden" id="umenu"><button data-go="#/perfil">Perfil y seguridad</button><button id="logout">Cerrar sesión</button></div></div>
      <div class="content" id="view">${inner}</div>
    </div></div>`;
  $('#ubtn').onclick = (e) => { e.stopPropagation(); $('#umenu').classList.toggle('hidden'); };
  document.onclick = () => $('#umenu')?.classList.add('hidden');
  $('#umenu [data-go]').onclick = () => go('#/perfil');
  $('#logout').onclick = async () => { await api('/api/logout', { method: 'POST' }); S.user = null; go('#/login'); };
  return $('#view');
}

/* ---------- Auth ---------- */
function authLayout(inner) {
  app.innerHTML = `<div class="auth"><div class="hero" style="background-image:url(/img/poster.jpg)"><div>Amateur Fight League<small>Sexta edición · 28 nov 2026</small></div></div>
    <div class="panel">${brand().replace('class="brand"', 'class="brand"')}${inner}</div></div>`;
}
function field(icon, label, attrs, req = true) {
  return `<div class="field"><label>${label}${req ? ' <em>*</em>' : ''}</label><div class="input">${I[icon]}<input ${attrs}></div></div>`;
}
function pageLogin() {
  authLayout(`<form id="f"><div><h1>Iniciar sesión</h1><p class="muted">Ingresa para solicitar tus entradas.</p></div>
    ${field('user', 'Correo electrónico o usuario', 'name="email" autocomplete="username" required')}
    ${field('lock', 'Contraseña', 'name="password" type="password" autocomplete="current-password" required')}
    <button class="btn full">Entrar</button><div class="err" id="err"></div>
    <p class="muted">¿No tienes cuenta? <a href="#/registro">Crear cuenta</a></p></form>`);
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); $('#err').textContent = '';
    try { await busy($('#f .btn'), () => api('/api/login', { method: 'POST', body: fd })); await boot(); go(S.user.role === 'admin' ? '#/admin' : '#/'); }
    catch (er) { if (er.data?.needsVerification) { go('#/verificar?email=' + encodeURIComponent(er.data.email)); toast('Verifica tu correo para continuar.'); } else $('#err').textContent = er.message; }
  };
}
function pageRegister() {
  authLayout(`<form id="f"><div><h1>Crear cuenta</h1><p class="muted">Te enviaremos un código para verificar tu correo.</p></div>
    ${field('user', 'Nombre completo', 'name="name" placeholder="Ej. Juan Pérez García" autocomplete="name" required')}
    ${field('mail', 'Correo electrónico', 'name="email" type="email" placeholder="usuario@correo.com" autocomplete="email" required')}
    ${field('phone', 'Teléfono (WhatsApp)', 'name="phone" type="tel" placeholder="5555-5555" autocomplete="tel" required')}
    ${field('lock', 'Contraseña', 'name="password" type="password" placeholder="Mínimo 8 caracteres, letras y números" autocomplete="new-password" required')}
    <button class="btn full">Crear cuenta</button><div class="err" id="err"></div>
    <p class="muted">¿Ya tienes cuenta? <a href="#/login">Iniciar sesión</a></p></form>`);
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); $('#err').textContent = '';
    try { const r = await busy($('#f .btn'), () => api('/api/register', { method: 'POST', body: fd })); go('#/verificar?email=' + encodeURIComponent(r.email)); }
    catch (er) { $('#err').textContent = er.message; }
  };
}
function pageVerify(q) {
  const email = new URLSearchParams(q).get('email') || '';
  authLayout(`<form id="f"><div><h1>Verifica tu correo</h1><p class="muted">Enviamos un código de 6 dígitos a <b>${esc(email)}</b>. Vence en 15 minutos.</p></div>
    <div class="field code-input"><div class="input"><input name="code" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code" required></div></div>
    <button class="btn full">Verificar</button><div class="err" id="err"></div>
    <p class="muted">¿No llegó? <button type="button" class="link" id="rs">Reenviar código</button> · <a href="#/login">Volver</a></p></form>`);
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); $('#err').textContent = '';
    try { await busy($('#f .btn'), () => api('/api/verify', { method: 'POST', body: { email, code: e.target.code.value } })); await boot(); toast('¡Cuenta verificada!', 'ok'); go('#/'); }
    catch (er) { $('#err').textContent = er.message; }
  };
  $('#rs').onclick = async () => { try { await api('/api/resend', { method: 'POST', body: { email } }); toast('Código reenviado.', 'ok'); } catch (er) { toast(er.message, 'err'); } };
}

/* ---------- Cliente ---------- */
function eventCard(e) {
  return `<article class="ev"><div class="poster" style="background-image:url(${esc(e.poster)})"></div><div class="body">
    <h3>${esc(e.title)}<small>${esc(e.subtitle)}</small></h3>
    <div class="row-i">${I.cal}<div><b>${fDate(e.event_date)}</b><span>${fTime(e.event_time)}</span></div></div>
    <div class="row-i">${I.pin}<div><b>${esc(e.location)}</b></div></div>
    <div class="row-i">${I.users}<div><span>Organiza:</span><b>${esc(e.organizer)}</b></div></div>
    <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center"><div><span class="muted small">Entrada</span><div class="price">${money(e.price)}</div></div>
    <a class="btn" href="#/evento/${e.id}">Solicitar entradas</a></div></div></article>`;
}
async function pageHome(withWelcome) {
  const v = shell(withWelcome ? '#/' : '#/eventos', '<div class="empty">Cargando…</div>');
  const { events } = await api('/api/events');
  v.innerHTML = `${withWelcome ? `<div class="welcome"><div class="avatar">${I.user}</div><div><h1>¡Bienvenido, ${esc(S.user.name)}!</h1><p class="muted">Gracias por ser parte de DOKAN. Aquí podrás solicitar tus entradas para el evento.</p></div></div>` : '<h1 style="margin-bottom:18px">Solicitar entradas</h1>'}
    <h2 style="margin-bottom:14px">Próximos eventos</h2>
    ${events.length ? `<div class="events">${events.map(eventCard).join('')}</div>` : '<div class="card empty">Aún no hay eventos disponibles.</div>'}`;
}
function bannerHTML(e) {
  return `<div class="banner"><div class="art" style="background-image:url(${esc(e.poster)})"></div><div class="info">
    <div class="row-i">${I.cal}<div><b>${fDate(e.event_date).toUpperCase()}</b><span>${fTime(e.event_time)}</span></div></div>
    <div class="row-i">${I.pin}<div><b>${esc(e.location)}</b></div></div>
    <div class="row-i">${I.users}<div><span>Organiza:</span><b>${esc(e.organizer)}</b></div></div></div>
    <img class="logo-img" src="/img/logo.png" alt="DOKAN"></div>`;
}
async function pageEvent(id) {
  const v = shell('#/eventos', '<div class="empty">Cargando…</div>');
  const { event: e } = await api('/api/events/' + id);
  let qty = 1;
  v.innerHTML = `${bannerHTML(e)}<div class="cols"><div>
    <form class="card" id="f"><div class="step-head"><span class="step-n">1</span><div><h2>Datos para solicitar</h2><p class="muted small">Completa la siguiente información para procesar tu solicitud de entradas.</p></div></div>
      <div class="form-grid">
        ${field('user', 'Nombre completo', `name="full_name" placeholder="Ej. Juan Pérez García" value="${esc(S.user.name)}" required`)}
        ${field('mail', 'Correo electrónico', `name="email" type="email" placeholder="Ej. usuario@correo.com" value="${esc(S.user.email)}" required`)}
        ${field('phone', 'Teléfono', `name="phone" type="tel" placeholder="Ej. 5555-5555" value="${esc(S.user.phone || '')}" required`)}
        ${field('id', 'DPI', 'name="dpi" inputmode="numeric" placeholder="Ej. 1234 56789 0101" maxlength="16" required')}
        ${field('cal', 'Fecha de nacimiento', 'name="birth" type="date" required')}
      </div>
      <div class="step-head" style="margin-top:26px"><span class="step-n">2</span><h2>Selecciona la cantidad de entradas</h2></div>
      <div class="qty-box"><div class="tk"><span class="ticket-ic">${I.ticket}</span><div><b>Entradas</b><br><span class="muted small">Precio por entrada</span></div></div>
        <div class="big-price">${money(e.price)}</div>
        <div class="stepper"><button type="button" data-d="-1">−</button><span id="q">1</span><button type="button" data-d="1">+</button></div></div>
      <div class="total"><span>Total a pagar</span><div class="big-price" id="tot">${money(e.price)}</div></div>
      <button class="btn full">${I.send} Enviar solicitud</button><div class="err" id="err"></div></form></div>
    <aside class="card sum"><div class="poster" style="background-image:url(${esc(e.poster)})"></div>
      <div class="row-i">${I.cal}<div><b>${fDate(e.event_date)}</b><span>${fTime(e.event_time)}</span></div></div>
      <div class="row-i">${I.pin}<div><b>${esc(e.location)}</b></div></div>
      <div class="row-i">${I.users}<div><span>Organiza:</span><b>${esc(e.organizer)}</b></div></div><hr>
      <div class="line"><span>Costo por entrada</span><span style="font-size:18px">${money(e.price)}</span></div>
      <div class="note">${I.info}<span>Tu solicitud será revisada por la administración. Te notificaremos el monto total a pagar y el procedimiento de pago.</span></div></aside></div>`;
  const upd = () => { $('#q').textContent = qty; $('#tot').textContent = money(e.price * qty); };
  v.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { qty = Math.min(10, Math.max(1, qty + Number(b.dataset.d))); upd(); });
  $('#f [name=dpi]').oninput = (ev) => { const d = ev.target.value.replace(/\D/g, '').slice(0, 13); ev.target.value = [d.slice(0, 4), d.slice(4, 9), d.slice(9)].filter(Boolean).join(' '); };
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault(); $('#err').textContent = '';
    const body = { ...Object.fromEntries(new FormData(ev.target)), event_id: e.id, qty };
    try { const r = await busy($('#f .btn.full'), () => api('/api/orders', { method: 'POST', body })); toast('Solicitud enviada. Ahora realiza tu transferencia.', 'ok'); go('#/pago/' + r.id); }
    catch (er) { $('#err').textContent = er.message; }
  };
}
function ticketsHTML(o) {
  return `<div class="tk-grid">${o.tickets.map((t) => `<a href="${t.url}" download="Boleto-${t.number}-DOKAN.png" target="_blank"><img src="${t.url}" alt="Boleto ${t.number}" loading="lazy"><span>Boleto #${t.number} · Descargar</span></a>`).join('')}</div>`;
}
async function pagePay(id) {
  const v = shell('#/mis-solicitudes', '<div class="empty">Cargando…</div>');
  const [{ order: o }, cfg] = await Promise.all([api('/api/orders/' + id), S.cfg ? { bank: S.cfg.bank } : api('/api/config')]);
  const b = cfg.bank;
  const head = `<div style="margin-bottom:16px"><a href="#/mis-solicitudes">← Mis solicitudes</a></div>
    <div class="card" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:center"><div><h2>Solicitud #${o.id} · ${esc(o.event.title)} ${esc(o.event.subtitle)}</h2>
      <p class="muted small">${o.qty} entrada${o.qty > 1 ? 's' : ''} · ${fDate(o.event.event_date)} · ${esc(o.event.location)}</p></div><div>${badge(o.status)}</div></div></div>`;
  if (o.status === 'aprobada') {
    v.innerHTML = head + `<div class="card"><h2>¡Pago confirmado! 🎉</h2><p class="muted">Tus boletos también fueron enviados a <b>${esc(o.email)}</b> y a tu WhatsApp (${esc(o.phone)}).</p>${ticketsHTML(o)}</div>`; return;
  }
  if (o.status === 'cancelada') { v.innerHTML = head + '<div class="card empty">Esta solicitud fue cancelada.</div>'; return; }
  const review = o.status === 'por_validar';
  v.innerHTML = head + `<div class="cols"><div>
    ${o.status === 'rechazada' ? `<div class="card" style="border-color:var(--err)"><b>Tu transferencia no pudo ser validada.</b><p class="muted">${esc(o.reject_reason || '')}</p><p class="small">Verifica el número y envíalo de nuevo.</p></div>` : ''}
    <div class="card"><div class="step-head"><span class="step-n">1</span><div><h2>Realiza la transferencia</h2><p class="muted small">Transfiere el monto exacto a la siguiente cuenta.</p></div></div>
      <div class="bank">
        <div class="r"><span>Banco</span><b>${esc(b.name)}</b></div>
        <div class="r"><span>Tipo de cuenta</span><b>${esc(b.type)}</b></div>
        <div class="r"><span>Número de cuenta</span><div><b>${esc(b.account)}</b><button class="copy" data-copy="${esc(b.account)}">Copiar</button></div></div>
        <div class="r"><span>A nombre de</span><b>${esc(b.holder)}</b></div>
        <div class="r"><span>Monto a transferir</span><b style="color:var(--yellow);font-size:22px">${money(o.total)}</b></div>
        <div class="r"><span>Referencia / comentario</span><div><b>Orden #${o.id}</b></div></div></div></div>
    <form class="card" id="f"><div class="step-head"><span class="step-n">2</span><div><h2>Ingresa tu número de autorización</h2><p class="muted small">Lo encuentras en el comprobante de tu transferencia.</p></div></div>
      ${review ? `<div class="note" style="margin:0 0 14px">${I.info}<span>Ya enviaste el número <b>${esc(o.auth_number)}</b> el ${fStamp(o.paid_at)}. La administración lo está revisando; puedes corregirlo si te equivocaste.</span></div>` : ''}
      ${field('id', 'Número de autorización', `name="auth_number" placeholder="Ej. 123456789" value="${esc(review ? o.auth_number : '')}" required`)}
      <button class="btn full" style="margin-top:16px">${I.send} ${review ? 'Actualizar número' : 'Enviar'}</button><div class="err" id="err"></div></form></div>
    <aside class="card sum"><div class="poster" style="background-image:url(${esc(o.event.poster)})"></div>
      <div class="line"><span>${o.qty} × ${money(o.event.price)}</span><span style="font-size:20px">${money(o.total)}</span></div>
      <div class="note">${I.info}<span>Cuando la administración confirme tu transferencia recibirás tus boletos con código QR por <b>correo</b> y <b>WhatsApp</b>.</span></div></aside></div>`;
  v.querySelectorAll('[data-copy]').forEach((c) => c.onclick = () => { navigator.clipboard?.writeText(c.dataset.copy); toast('Copiado', 'ok'); });
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault(); $('#err').textContent = '';
    try { await busy($('#f .btn'), () => api(`/api/orders/${o.id}/payment`, { method: 'POST', body: { auth_number: ev.target.auth_number.value } })); toast('Número enviado. Estamos validando tu transferencia.', 'ok'); go('#/pago/' + o.id); }
    catch (er) { $('#err').textContent = er.message; }
  };
}
async function pageMyOrders() {
  const v = shell('#/mis-solicitudes', '<div class="empty">Cargando…</div>');
  const { orders } = await api('/api/orders');
  v.innerHTML = `<h1 style="margin-bottom:18px">Mi solicitud</h1>${orders.length ? `<div class="list">${orders.map((o) => `<div class="card order"><div>
      <h3>#${o.id} · ${esc(o.event.title)} ${esc(o.event.subtitle)} ${badge(o.status)}</h3>
      <div class="meta"><span>${o.qty} entrada${o.qty > 1 ? 's' : ''}</span><span>${money(o.total)}</span><span>${fDate(o.event.event_date)}</span><span>Creada ${fStamp(o.created_at)}</span></div>
      ${o.status === 'rechazada' ? `<p class="small" style="color:#ff9b9b;margin-top:6px">${esc(o.reject_reason || '')}</p>` : ''}</div>
      <div class="acts">${o.status === 'aprobada' ? `<a class="btn sm ok" href="#/pago/${o.id}">Ver boletos</a>` : ['solicitada', 'rechazada', 'por_validar'].includes(o.status) ? `<a class="btn sm" href="#/pago/${o.id}">${o.status === 'por_validar' ? 'Ver estado' : 'Pagar / reportar transferencia'}</a>` : ''}
      ${o.status === 'solicitada' ? `<button class="btn sm ghost" data-cancel="${o.id}">Cancelar</button>` : ''}</div></div>`).join('')}</div>`
    : '<div class="card empty">Aún no tienes solicitudes. <br><br><a class="btn" href="#/eventos">Solicitar entradas</a></div>'}`;
  v.querySelectorAll('[data-cancel]').forEach((b) => b.onclick = async () => {
    if (!confirm('¿Cancelar esta solicitud?')) return;
    try { await api('/api/orders/' + b.dataset.cancel, { method: 'DELETE' }); pageMyOrders(); } catch (er) { toast(er.message, 'err'); }
  });
}
function pageProfile() {
  const v = shell('#/perfil', '');
  v.innerHTML = `<h1 style="margin-bottom:18px">Perfil y seguridad</h1><div class="cols cols-eq">
    <div class="card"><h2>Mis datos</h2><div class="bank"><div class="r"><span>Nombre</span><b>${esc(S.user.name)}</b></div><div class="r"><span>Correo</span><b>${esc(S.user.email)}</b></div>${S.user.phone ? `<div class="r"><span>Teléfono</span><b>${esc(S.user.phone)}</b></div>` : ''}</div></div>
    <form class="card" id="f"><h2 style="margin-bottom:14px">Cambiar contraseña</h2><div style="display:grid;gap:14px">
      ${field('lock', 'Contraseña actual', 'name="current" type="password" autocomplete="current-password" required')}
      ${field('lock', 'Nueva contraseña', 'name="password" type="password" autocomplete="new-password" placeholder="Mínimo 8, letras y números" required')}
      <button class="btn">Guardar</button><div class="err" id="err"></div></div></form></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); $('#err').textContent = '';
    try { await busy($('#f .btn'), () => api('/api/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) })); toast('Contraseña actualizada.', 'ok'); e.target.reset(); }
    catch (er) { $('#err').textContent = er.message; }
  };
}

/* ---------- Admin ---------- */
async function pageAdminHome() {
  const v = shell('#/admin', '<div class="empty">Cargando…</div>');
  const s = await api('/api/admin/stats');
  v.innerHTML = `<h1 style="margin-bottom:18px">Panel de administración</h1><div class="stats">
    <div class="stat"><b style="color:var(--yellow)">${s.por_validar}</b><span>Transferencias por validar</span></div>
    <div class="stat"><b>${s.aprobadas}</b><span>Solicitudes aprobadas</span></div>
    <div class="stat"><b>${s.boletos}</b><span>Boletos emitidos</span></div>
    <div class="stat"><b>${s.ingresados}</b><span>Ingresos registrados</span></div>
    <div class="stat"><b>${money(s.recaudado)}</b><span>Recaudado</span></div></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn" href="#/admin/solicitudes">Revisar solicitudes</a><a class="btn ghost" href="#/admin/escaner">Abrir escáner QR</a></div>`;
}
let adminTab = 'por_validar';
async function pageAdminOrders() {
  const v = shell('#/admin/solicitudes', '<div class="empty">Cargando…</div>');
  const { orders } = await api('/api/admin/orders' + (adminTab === 'todas' ? '' : '?status=' + adminTab));
  const tabs = [['por_validar', 'Por validar'], ['aprobada', 'Aprobadas'], ['solicitada', 'Sin pago'], ['rechazada', 'Rechazadas'], ['todas', 'Todas']];
  v.innerHTML = `<h1 style="margin-bottom:16px">Solicitudes</h1><div class="tabs">${tabs.map(([k, t]) => `<button class="tab ${adminTab === k ? 'active' : ''}" data-tab="${k}">${t}</button>`).join('')}</div>
    ${orders.length ? `<div class="list">${orders.map((o) => `<div class="card order"><div>
      <h3>#${o.id} · ${esc(o.full_name)} ${badge(o.status)}</h3>
      <div class="meta"><span>${esc(o.event.title)} ${esc(o.event.subtitle)}</span><span><b>${o.qty}</b> entrada${o.qty > 1 ? 's' : ''}</span><span><b>${money(o.total)}</b></span>
        <span>DPI ${esc(o.dpi)}</span><span>${esc(o.account_email || o.email)}</span><span>Tel. ${esc(o.phone)}</span></div>
      ${o.auth_number ? `<div style="margin-top:8px">Nº de autorización: <b style="color:var(--yellow);font-size:18px">${esc(o.auth_number)}</b> <span class="muted small">· reportado ${fStamp(o.paid_at)}</span></div>` : '<div class="muted small" style="margin-top:8px">Aún no reporta transferencia.</div>'}
      ${o.status === 'aprobada' ? `<div class="muted small" style="margin-top:6px">Boletos: ${o.tickets.map((t) => '#' + t.number).join(', ')} · Correo: ${esc(o.email_status || '—')} · WhatsApp: ${esc(o.wa_status || '—')}</div>` : ''}
      ${o.status === 'rechazada' ? `<div class="small" style="color:#ff9b9b;margin-top:6px">${esc(o.reject_reason || '')}</div>` : ''}</div>
      <div class="acts">${o.status === 'por_validar' ? `<button class="btn sm ok" data-ok="${o.id}">Autorizar</button><button class="btn sm danger" data-no="${o.id}">Rechazar</button>` : ''}
      ${o.status === 'aprobada' && o.wa_link ? `<a class="btn sm wa" target="_blank" rel="noopener" href="${esc(o.wa_link)}">WhatsApp</a>` : ''}
      ${o.status === 'aprobada' ? o.tickets.map((t) => `<a class="btn sm ghost" target="_blank" href="${t.url}">Boleto ${t.number}</a>`).join('') : ''}</div></div>`).join('')}</div>` : '<div class="card empty">No hay solicitudes en esta categoría.</div>'}`;
  v.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { adminTab = b.dataset.tab; pageAdminOrders(); });
  v.querySelectorAll('[data-ok]').forEach((b) => b.onclick = async () => {
    if (!confirm('¿Confirmas que la transferencia llegó a la cuenta? Se enviarán los boletos al cliente.')) return;
    try {
      const r = await busy(b, () => api(`/api/admin/orders/${b.dataset.ok}/approve`, { method: 'POST' }));
      toast(`Autorizado. Correo: ${r.order.email_status} · WhatsApp: ${r.order.wa_status}`, 'ok'); adminTab = 'aprobada'; pageAdminOrders();
    } catch (er) { toast(er.message, 'err'); }
  });
  v.querySelectorAll('[data-no]').forEach((b) => b.onclick = async () => {
    const reason = prompt('Motivo del rechazo (se mostrará al cliente):', 'No encontramos la transferencia con ese número de autorización.');
    if (reason === null) return;
    try { await api(`/api/admin/orders/${b.dataset.no}/reject`, { method: 'POST', body: { reason } }); toast('Solicitud rechazada.'); pageAdminOrders(); } catch (er) { toast(er.message, 'err'); }
  });
}
async function pageAdminEvents() {
  const v = shell('#/admin/eventos', '<div class="empty">Cargando…</div>');
  const { events } = await api('/api/admin/events');
  v.innerHTML = `<h1 style="margin-bottom:18px">Eventos</h1><div class="cols cols-eq">
    <div class="list">${events.map((e) => `<div class="card order"><div><h3>${esc(e.title)} ${esc(e.subtitle)} ${e.active ? '<span class="badge b-aprobada">Activo</span>' : '<span class="badge b-cancelada">Oculto</span>'}</h3><div class="meta"><span>${fDate(e.event_date)} ${fTime(e.event_time)}</span><span>${esc(e.location)}</span><span>${money(e.price)}</span></div></div>
      <div class="acts"><button class="btn sm ghost" data-tg="${e.id}">${e.active ? 'Ocultar' : 'Mostrar'}</button></div></div>`).join('')}</div>
    <form class="card" id="f"><h2 style="margin-bottom:14px">Nuevo evento</h2><div style="display:grid;gap:12px">
      ${field('ticket', 'Título', 'name="title" placeholder="Amateur Fight League" required')}
      ${field('ticket', 'Subtítulo', 'name="subtitle" placeholder="Séptima Edición"', false)}
      ${field('cal', 'Fecha', 'name="event_date" type="date" required')}${field('cal', 'Hora', 'name="event_time" type="time" value="18:00" required')}
      ${field('pin', 'Lugar', 'name="location" required')}${field('users', 'Organizador', 'name="organizer" required')}
      ${field('ticket', 'Precio por entrada (Q)', 'name="price" type="number" min="1" step="0.01" required')}
      <div class="field"><label>Imagen del póster (opcional, horizontal)</label><div class="input"><input type="file" name="img" accept="image/png,image/jpeg,image/webp"></div></div>
      <button class="btn">Crear evento</button><div class="err" id="err"></div></div></form></div>`;
  v.querySelectorAll('[data-tg]').forEach((b) => b.onclick = async () => { await api(`/api/admin/events/${b.dataset.tg}/toggle`, { method: 'POST' }); pageAdminEvents(); });
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); $('#err').textContent = '';
    const fd = Object.fromEntries(new FormData(e.target)); const file = e.target.img.files[0]; delete fd.img;
    if (file) { if (file.size > 5e6) { $('#err').textContent = 'La imagen supera 5 MB.'; return; } fd.image_data = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); }); }
    try { await busy($('#f .btn'), () => api('/api/admin/events', { method: 'POST', body: fd })); toast('Evento creado.', 'ok'); pageAdminEvents(); } catch (er) { $('#err').textContent = er.message; }
  };
}
let scanner = null;
async function stopScanner() { if (scanner) { try { await scanner.stop(); } catch { /* ya detenido */ } scanner = null; } }
async function pageScanner() {
  const v = shell('#/admin/escaner', '');
  v.innerHTML = `<h1 style="margin-bottom:6px">Escáner de boletos</h1><p class="muted" style="margin-bottom:18px">Apunta la cámara al código QR del boleto. La cámara requiere HTTPS (o localhost).</p>
    <div class="cols cols-scan"><div><div id="reader"></div><div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn sm" id="start">Iniciar cámara</button><button class="btn sm ghost" id="stop">Detener</button></div>
    <form id="mf" class="field" style="margin-top:18px"><label>¿Sin cámara? Pega el código del QR</label><div class="input"><input name="c" placeholder="DOKAN|…"></div></form><div class="err" id="serr"></div></div>
    <div id="res"><div class="card empty">El resultado del escaneo aparecerá aquí.</div></div></div>`;
  let last = '', lastAt = 0;
  async function check(raw) {
    if (raw === last && Date.now() - lastAt < 4000) return; last = raw; lastAt = Date.now();
    try {
      const r = await api('/api/admin/scan', { method: 'POST', body: { code: raw } });
      if (!r.valid) { $('#res').innerHTML = `<div class="scan-res bad"><h2>❌ BOLETO NO VÁLIDO</h2><p>${esc(r.reason)}</p></div>`; return; }
      const t = r.ticket;
      $('#res').innerHTML = `<div class="scan-res ${t.used ? 'warn' : 'ok'}"><h2>${t.used ? '⚠️ BOLETO YA UTILIZADO' : '✅ BOLETO VÁLIDO'}</h2>
        ${t.used ? `<p>Ingresó el ${fStamp(t.used_at)}</p>` : ''}<div class="muted small" style="margin-top:10px">BOLETÍN</div><div class="num">${esc(t.number)}</div>
        <dl><dt>Nombre</dt><dd><b>${esc(t.name)}</b></dd><dt>Nacimiento</dt><dd>${esc(t.birth)}</dd><dt>DPI</dt><dd>${esc(t.dpi)}</dd><dt>Evento</dt><dd>${esc(t.event)}</dd>
        <dt>Fecha</dt><dd>${esc(t.date)} · ${esc(t.time)}</dd><dt>Lugar</dt><dd>${esc(t.location)}</dd><dt>Organiza</dt><dd>${esc(t.organizer)}</dd></dl>
        ${t.used ? '' : '<button class="btn ok full" id="ci">Registrar ingreso</button>'}</div>`;
      $('#ci')?.addEventListener('click', async (ev) => {
        try { await busy(ev.currentTarget, () => api('/api/admin/checkin', { method: 'POST', body: { code: raw } })); toast('Ingreso registrado ✔', 'ok'); last = ''; check(raw); } catch (er) { toast(er.message, 'err'); }
      });
    } catch (er) { toast(er.message, 'err'); }
  }
  $('#mf').onsubmit = (e) => { e.preventDefault(); const c = e.target.c.value.trim(); if (c) check(c); };
  $('#stop').onclick = stopScanner;
  $('#start').onclick = async () => {
    $('#serr').textContent = '';
    try {
      if (!window.Html5Qrcode) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'; s.onload = ok; s.onerror = () => no(new Error('No se pudo cargar el lector (¿sin internet?).')); document.head.append(s); });
      await stopScanner(); scanner = new Html5Qrcode('reader');
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, (text) => check(text), () => {});
    } catch (er) { $('#serr').textContent = 'No se pudo iniciar la cámara: ' + (er.message || er); }
  };
}

/* ---------- Router ---------- */
async function route() {
  await stopScanner();
  const raw = location.hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  try {
    if (!S.user) {
      if (p === '/registro') return pageRegister();
      if (p === '/verificar') return pageVerify(q);
      return pageLogin();
    }
    if (['/login', '/registro', '/verificar'].includes(p)) return go(S.user.role === 'admin' ? '#/admin' : '#/');
    const admin = S.user.role === 'admin';
    if (p.startsWith('/admin')) {
      if (!admin) return go('#/');
      if (p === '/admin') return await pageAdminHome();
      if (p === '/admin/solicitudes') return await pageAdminOrders();
      if (p === '/admin/eventos') return await pageAdminEvents();
      if (p === '/admin/escaner') return await pageScanner();
      return go('#/admin');
    }
    if (p === '/perfil') return pageProfile();
    if (admin) return go('#/admin');
    let m;
    if (p === '/') return await pageHome(true);
    if (p === '/eventos') return await pageHome(false);
    if ((m = p.match(/^\/evento\/(\d+)$/))) return await pageEvent(m[1]);
    if ((m = p.match(/^\/pago\/(\d+)$/))) return await pagePay(m[1]);
    if (p === '/mis-solicitudes') return await pageMyOrders();
    go('#/');
  } catch (e) {
    if (e.status === 401) { S.user = null; return pageLogin(); }
    const v = $('#view') || app; v.innerHTML = `<div class="card empty">${esc(e.message)}<br><br><a class="btn" href="#/">Volver al inicio</a></div>`;
  }
}
async function boot() {
  const { user } = await api('/api/me'); S.user = user;
  if (user) S.cfg = await api('/api/config');
}
window.addEventListener('hashchange', route);
boot().then(route).catch(() => route());
