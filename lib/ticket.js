'use strict';
// Genera el boleto (PNG 1066x1600) con el diseño DOKAN: póster arriba, fecha + QR, datos del comprador y patrocinadores.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const QRCode = require('qrcode');

const W = 1066, H = 1600, POSTER_H = 810;
const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const FONT = "'Arial Black','Impact','Helvetica Neue',Arial,sans-serif";
const FONT_TXT = "'Segoe UI','Helvetica Neue',Arial,sans-serif";

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fit = (text, max, width, k = 0.56) => Math.max(14, Math.min(max, Math.floor(width / (String(text).length * k))));

function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return { y, m, d };
}
function fmtDMY(iso) {
  const { y, m, d } = parseISO(iso);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}
function fmtTime(t) {
  const [h, mi] = String(t || '18:00').split(':').map(Number);
  const ap = h >= 12 ? 'P.M.' : 'A.M.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mi).padStart(2, '0')} ${ap}`;
}
function fmtDPI(d) {
  const s = String(d).replace(/\D/g, '');
  return s.length === 13 ? `${s.slice(0, 4)}-${s.slice(4, 9)}-${s.slice(9)}` : s;
}

function sponsorSlots(rootDir) {
  const dir = path.join(rootDir, 'public', 'img', 'sponsors');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort().slice(0, 4); } catch { /* sin patrocinadores */ }
  return files.map((f) => path.join(dir, f));
}

async function renderTicket({ number, name, birth, dpi, code, event }, rootDir) {
  const { d, m, y } = parseISO(event.event_date);
  const mes = MESES[m - 1] || '';
  const mesSize = fit(mes, 80, 400, 0.66);

  // Póster
  let posterBuf;
  const posterPath = event.poster ? path.join(rootDir, 'public', event.poster.replace(/^\/+/, '')) : null;
  if (posterPath && fs.existsSync(posterPath)) {
    posterBuf = await sharp(posterPath).resize(W, POSTER_H, { fit: 'cover', position: 'attention' }).jpeg({ quality: 92 }).toBuffer();
  } else {
    posterBuf = await sharp({ create: { width: W, height: POSTER_H, channels: 3, background: '#06122b' } }).jpeg().toBuffer();
  }

  // QR (negro sobre blanco para que cualquier lector lo detecte)
  const qr = await QRCode.toBuffer(`DOKAN|${code}`, { errorCorrectionLevel: 'M', margin: 1, width: 230, color: { dark: '#000000', light: '#ffffff' } });

  const nameStr = String(name);
  const orgStr = String(event.organizer || '');
  const locStr = String(event.location || '');

  const slots = sponsorSlots(rootDir);
  const slotX = [165, 408, 650, 895];
  const sponsorsSvg = slotX.map((cx, i) => (slots[i] ? '' : `
    <path d="M${cx - 18} 1530 l18 -30 l18 30 z" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
    <text x="${cx}" y="1562" text-anchor="middle" font-family="${FONT_TXT}" font-weight="700" font-size="17" fill="#fff">TU LOGO AQUÍ</text>`)).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- Número de boletín -->
  <text x="55" y="108" font-family="${FONT}" font-weight="900" font-size="72" fill="#fff">${esc(number)}</text>
  <rect x="55" y="120" width="113" height="4" fill="#ffd400"/>
  <text x="57" y="152" font-family="${FONT_TXT}" font-weight="800" font-size="23" fill="#fff" letter-spacing="1">BOLETÍN</text>

  <!-- Franja fecha + QR -->
  <rect x="0" y="${POSTER_H + 2}" width="${W}" height="${1118 - POSTER_H - 2}" fill="#050505"/>
  <polygon points="0,1060 70,1030 90,1118 0,1118" fill="#ffd400" opacity=".9"/>
  <polygon points="${W},1070 ${W - 70},1040 ${W - 90},1118 ${W},1118" fill="#ffd400" opacity=".9"/>
  <text x="275" y="945" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="150" fill="#fff">${d}</text>
  <text x="275" y="1018" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="${mesSize}" fill="#fff">${esc(mes)}</text>
  <text x="275" y="1090" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="80" fill="#ffd400">${y}</text>
  <rect x="533" y="850" width="3" height="235" fill="#ffd400"/>
  <rect x="660" y="842" width="262" height="250" rx="22" fill="#fff" stroke="#ffd400" stroke-width="5"/>

  <!-- Datos -->
  <rect x="0" y="1118" width="${W}" height="352" fill="#fff"/>
  <polygon points="40,1155 485,1155 470,1200 25,1200" fill="#050505"/>
  <polygon points="40,1155 62,1155 47,1200 25,1200" fill="#ffd400"/>
  <text x="110" y="1188" font-family="${FONT_TXT}" font-weight="800" font-size="28" fill="#fff">DATOS DEL COMPRADOR</text>
  <polygon points="580,1155 1020,1155 1005,1200 565,1200" fill="#050505"/>
  <polygon points="580,1155 602,1155 587,1200 565,1200" fill="#ffd400"/>
  <text x="658" y="1188" font-family="${FONT_TXT}" font-weight="800" font-size="28" fill="#fff">ORGANIZADO POR:</text>
  <rect x="532" y="1150" width="2" height="296" fill="#c8c8c8"/>

  <text x="60" y="1242" font-family="${FONT_TXT}" font-weight="800" font-size="26" fill="#111">Nombre:</text>
  <text x="60" y="1277" font-family="${FONT_TXT}" font-size="${fit(nameStr, 30, 440)}" fill="#111">${esc(nameStr)}</text>
  <text x="60" y="1327" font-family="${FONT_TXT}" font-weight="800" font-size="26" fill="#111">Fecha de nacimiento:</text>
  <text x="60" y="1360" font-family="${FONT_TXT}" font-size="30" fill="#111">${esc(fmtDMY(birth))}</text>
  <text x="60" y="1409" font-family="${FONT_TXT}" font-weight="800" font-size="26" fill="#111">DPI:</text>
  <text x="60" y="1442" font-family="${FONT_TXT}" font-size="30" fill="#111">${esc(fmtDPI(dpi))}</text>

  <text x="604" y="1250" font-family="${FONT_TXT}" font-weight="800" font-size="${fit(orgStr, 34, 410, 0.58)}" fill="#111">${esc(orgStr)}</text>
  <text x="604" y="1312" font-family="${FONT_TXT}" font-weight="800" font-size="26" fill="#111">Horario:</text>
  <text x="604" y="1346" font-family="${FONT_TXT}" font-size="30" fill="#111">${esc(fmtTime(event.event_time))}</text>
  <text x="604" y="1403" font-family="${FONT_TXT}" font-weight="800" font-size="26" fill="#111">Ubicación:</text>
  <text x="604" y="1437" font-family="${FONT_TXT}" font-size="${fit(locStr, 30, 410)}" fill="#111">${esc(locStr)}</text>

  <!-- Pie -->
  <rect x="0" y="1470" width="${W}" height="130" fill="#050505"/>
  <polygon points="0,1478 50,1470 0,1530" fill="#ffd400"/>
  <polygon points="${W},1478 ${W - 50},1470 ${W},1530" fill="#ffd400"/>
  <polygon points="0,1600 70,1600 0,1560" fill="#ffd400"/>
  <polygon points="${W},1600 ${W - 70},1600 ${W},1560" fill="#ffd400"/>
  <rect x="291" y="1503" width="3" height="52" fill="#ffd400"/>
  <rect x="529" y="1503" width="3" height="52" fill="#ffd400"/>
  <rect x="769" y="1503" width="3" height="52" fill="#ffd400"/>
  ${sponsorsSvg}
</svg>`;

  const layers = [
    { input: posterBuf, top: 0, left: 0 },
    { input: Buffer.from(svg), top: 0, left: 0 },
    { input: qr, top: 852, left: 676 },
  ];
  for (let i = 0; i < slots.length; i++) {
    const logo = await sharp(slots[i]).resize(170, 80, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const meta = await sharp(logo).metadata();
    layers.push({ input: logo, left: Math.round(slotX[i] - meta.width / 2), top: Math.round(1535 - meta.height / 2) });
  }

  return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(layers).png({ compressionLevel: 9 }).toBuffer();
}

module.exports = { renderTicket, fmtDMY, fmtTime, fmtDPI, MESES };
