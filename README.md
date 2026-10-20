# DOKAN · Tickets & Eventos

Plataforma de venta de entradas por transferencia bancaria, con boleto digital (QR), envío por correo y WhatsApp y escáner de ingreso.

## Flujo
1. El cliente **crea una cuenta** (correo + teléfono + contraseña) y **verifica su correo** con un código de 6 dígitos.
2. Ve los **eventos**, elige uno y llena la **solicitud** (nombre, correo, teléfono, DPI, fecha de nacimiento, cantidad).
3. Al pulsar **Enviar solicitud** ve la **cuenta bancaria** a la que debe transferir e ingresa el **número de autorización**.
4. La solicitud llega al **admin** (usuario `admin`, contraseña `Dokan123`), que revisa su banco y pulsa **Autorizar** (o Rechazar).
5. Al autorizar se genera el **boleto con QR** (uno por entrada, con número de boletín correlativo) y se envía al **correo** y al **WhatsApp** registrados. También queda descargable en "Mi solicitud".
6. En la entrada, el admin abre **Escáner QR**: si es válido muestra boletín y datos del comprador y puede **registrar el ingreso** (un boleto no se puede usar dos veces).

## Instalación (necesitas Node.js 22.5 o superior)
```bash
npm install
cp .env.example .env     # en Windows: copy .env.example .env
# edita .env: cuenta bancaria, PUBLIC_URL, SMTP, WhatsApp...
npm start
```
Abre http://localhost:3000

## Configuración (.env)
| Variable | Para qué |
|---|---|
| `BANK_*` | Datos de la cuenta que ve el cliente al enviar la solicitud |
| `ADMIN_USER` / `ADMIN_PASS` | Admin (se crea la primera vez; por defecto `admin` / `Dokan123`). **Cámbiala antes de publicar.** |
| `PUBLIC_URL` | URL pública del sitio (WhatsApp descarga el boleto desde ahí) |
| `SMTP_*` | Correo real. Con Gmail usa una *contraseña de aplicación*. Sin SMTP los correos (y códigos de verificación) se imprimen en la consola y en `data/outbox.log` |
| `WHATSAPP_PROVIDER` | `none` (botón "WhatsApp" para el admin), `twilio` o `meta` (envío automático con la imagen) |

> Si cambias `ADMIN_PASS` después de la primera ejecución, borra `data/dokan.db` o cambia la contraseña desde *Perfil y seguridad*.

### WhatsApp
- **none**: al autorizar, el admin ve un botón verde "WhatsApp" que abre el chat con el cliente con el mensaje y el enlace del boleto listos para enviar. No requiere cuentas de pago.
- **twilio**: crea una cuenta de Twilio con WhatsApp y llena `TWILIO_*`. Envía la imagen del boleto automáticamente.
- **meta**: WhatsApp Cloud API (`META_TOKEN`, `META_PHONE_ID`). Para escribir a clientes fuera de la ventana de 24 h Meta exige plantillas aprobadas.

En ambos modos automáticos `PUBLIC_URL` debe ser accesible desde internet.

### Cámara del escáner
Los navegadores solo permiten usar la cámara en **HTTPS** (o localhost). Para usarlo desde el celular publica el sitio con HTTPS (Render, Railway, un VPS con Caddy/Nginx, o un túnel como Cloudflare Tunnel).

## Personalización
- **Póster/banner**: `public/img/poster.jpg`; para nuevos eventos el admin sube la imagen desde *Eventos*.
- **Patrocinadores del boleto**: coloca hasta 4 logos (PNG) en `public/img/sponsors/`; reemplazan los "TU LOGO AQUÍ".
- **Boleto**: el diseño está en `lib/ticket.js`.
- Datos en `data/dokan.db` (SQLite) y boletos en `data/tickets/`. Haz copias de la carpeta `data`.

## Seguridad incluida
Contraseñas con scrypt, sesiones con cookie HttpOnly, códigos de verificación con vencimiento e intentos limitados, límite de intentos de login, números de autorización no reutilizables, boletos con código aleatorio de 128 bits y rutas de admin protegidas en el servidor.
