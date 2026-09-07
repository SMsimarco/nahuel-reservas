# Club Nahuel · Reservas

App de reservas online para Club Nahuel (Pozos 501, Tandil), un club de pádel y fútbol. Los clientes reservan cancha desde el celular sin llamar (login con OTP por email, grilla semanal de turnos por deporte), y el club gestiona todo desde un panel de admin aparte (turnos, bloqueos de horario, exportación). Al confirmarse una reserva se dispara automáticamente un WhatsApp de confirmación al cliente.

## Stack

- **Frontend:** HTML/CSS/JS vanilla, sin build ni framework (no hay `package.json`)
- **PWA:** `manifest.json` + `sw.js` (service worker con cache-first para assets estáticos, network-first para Supabase)
- **Backend/DB:** [Supabase](https://supabase.com) — Postgres vía REST (`/rest/v1/bookings`, `/rest/v1/blocks`) y Supabase Auth (OTP por email para clientes, email+password para admin)
- **Notificaciones:** Supabase Edge Function (`supabase/functions/notify-booking`, Deno) que se dispara con un Database Webhook al insertar una reserva, y manda WhatsApp vía **Twilio**
- **Deploy:** Vercel — https://nahuel-reservas.vercel.app

## Estructura

```
index.html      → app de reservas para clientes
app.js           → lógica de la app cliente (grilla, login OTP, reservas, "mis turnos")
admin.html/js/css → panel de administración (turnos, bloqueos, exportar)
style.css        → estilos de la app cliente
manifest.json, sw.js → PWA
supabase/functions/notify-booking/ → Edge Function de notificación WhatsApp (Twilio)
```

## Correrlo en local

No hay build ni dependencias de Node — es HTML/JS estático. Basta con levantar cualquier servidor estático en la raíz del repo, por ejemplo:

```bash
npx serve .
# o
python -m http.server 8000
```

Después abrís `index.html` (app de clientes) o `admin.html` (panel de admin) en el navegador.

## Variables de entorno / configuración

No hay `.env.example` en el repo. La configuración de Supabase para el frontend está hardcodeada directamente en `app.js`:

```js
const SB_URL = 'https://tzfnjozxvdnadaryyahy.supabase.co';
const SB_KEY = 'sb_publishable_z6R0-d9ulf316kicFHFeAQ_Dw2cANhr'; // publishable key, OK exponerla client-side
```

Para la Edge Function de notificaciones (`supabase/functions/notify-booking`), las credenciales de Twilio se cargan como **Supabase Secrets** (no viven en el repo), según el detalle en `supabase/functions/notify-booking/SETUP.md`:

```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_FROM=whatsapp:+14155238886
```

Ese mismo archivo `SETUP.md` documenta paso a paso cómo linkear el proyecto de Supabase, deployar la función y crear el Database Webhook que la dispara.

## Deploy

Producción en Vercel: **https://nahuel-reservas.vercel.app**. No hay `vercel.json` en el repo — al ser un sitio estático sin build, Vercel lo sirve directo sin configuración adicional.
