# Setup: Notificaciones WhatsApp por Twilio

## 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

## 2. Vincular el proyecto

En la carpeta `nahuel-reservas`:

```bash
supabase login
supabase link --project-ref tzfnjozxvdnadaryyahy
```

## 3. Cargar los secrets de Twilio

(Usá los mismos datos que tenés en n8n)

```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_FROM=whatsapp:+14155238886
```

> **TWILIO_FROM:**
> - Sandbox (para pruebas): `whatsapp:+14155238886`
> - Número propio aprobado: `whatsapp:+54XXXXXXXXXX`

## 4. Deployar la función

```bash
supabase functions deploy notify-booking
```

La URL de la función va a quedar así:
```
https://tzfnjozxvdnadaryyahy.supabase.co/functions/v1/notify-booking
```

## 5. Crear el Database Webhook en Supabase

1. Entrá al dashboard: https://supabase.com/dashboard/project/tzfnjozxvdnadaryyahy
2. Ir a **Database → Webhooks**
3. Click en **Create a new hook**
4. Configurar:
   - **Name:** `on_booking_insert`
   - **Table:** `bookings`
   - **Events:** ✅ `INSERT`
   - **Type:** HTTP Request (Supabase Edge Functions)
   - **URL:** `https://tzfnjozxvdnadaryyahy.supabase.co/functions/v1/notify-booking`
   - **HTTP Headers:** agregar `Authorization: Bearer <tu anon key>`
5. Guardar

## 6. Probar

Hacé una reserva desde la app. En segundos debería llegar el WhatsApp con:

```
✅ Reserva confirmada, Juan!

🏸 Pádel · Cancha A
📅 martes 15 de abril
⏰ 10:00 hs · 60 min

📍 Club Nahuel · Pozos 501, Tandil

Para cancelar, ingresá a la app y buscá "Mis turnos".
```

## Troubleshooting

- Ver logs: `supabase functions logs notify-booking`
- Si Twilio dice error 63016: el número del cliente no está en la **sandbox whitelist**
  → El cliente tiene que mandar `join <tu-palabra>` al número de sandbox primero
- Si usás número propio de Twilio, no hay whitelist, funciona directo
