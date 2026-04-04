// Supabase Edge Function: notify-booking
// Se dispara cuando se inserta una reserva nueva en la tabla `bookings`.
// Envía un mensaje de WhatsApp al cliente via Twilio.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/* ── CONFIGURACIÓN (Supabase Secrets) ─────────────
   supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxx
   supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxx
   supabase secrets set TWILIO_FROM=whatsapp:+14155238886
──────────────────────────────────────────────────── */
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM        = Deno.env.get("TWILIO_FROM")!; // whatsapp:+14155238886 (sandbox) o tu número

const SPORTS: Record<string, { name: string; icon: string }> = {
  padel:  { name: "Pádel",  icon: "🏸" },
  futbol: { name: "Fútbol", icon: "⚽" },
};

/* ── FORMATEAR TELÉFONO ARGENTINO ────────────────
   Entrada: "2494 123456", "02494123456", "11 1234 5678"
   Salida:  "whatsapp:+5492494123456"
──────────────────────────────────────────────────── */
function formatArgPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;

  let normalized: string;

  if (digits.startsWith("549")) {
    normalized = digits; // ya tiene código país + 9
  } else if (digits.startsWith("54")) {
    normalized = "549" + digits.slice(2); // agregar 9 para WhatsApp
  } else if (digits.startsWith("0")) {
    normalized = "549" + digits.slice(1); // quitar 0, agregar +549
  } else {
    normalized = "549" + digits; // agregar prefijo completo
  }

  return `whatsapp:+${normalized}`;
}

/* ── FORMATEAR FECHA ─────────────────────────────── */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/* ── ARMAR MENSAJE ───────────────────────────────── */
function buildMessage(booking: Record<string, string>): string {
  const sport  = SPORTS[booking.sport] ?? { name: booking.sport, icon: "🏟" };
  const fecha  = formatDate(booking.date);
  const nombre = booking.name.split(" ")[0]; // solo el primer nombre

  return (
    `✅ *Reserva confirmada, ${nombre}!*\n\n` +
    `${sport.icon} *${sport.name}* · ${booking.court}\n` +
    `📅 ${fecha}\n` +
    `⏰ ${booking.time} hs · 60 min\n\n` +
    `📍 *Club Nahuel* · Pozos 501, Tandil\n\n` +
    `_Para cancelar, ingresá a la app y buscá "Mis turnos"._`
  );
}

/* ── ENVIAR WHATSAPP VIA TWILIO ───────────────────── */
async function sendWhatsApp(to: string, body: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const params = new URLSearchParams({
    From: TWILIO_FROM,
    To:   to,
    Body: body,
  });

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Twilio error ${res.status}: ${error}`);
  }
}

/* ── HANDLER PRINCIPAL ───────────────────────────── */
serve(async (req) => {
  // Solo aceptar POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: { type: string; record: Record<string, string> };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Solo procesar eventos INSERT
  if (payload.type !== "INSERT") {
    return new Response("Ignored", { status: 200 });
  }

  const booking = payload.record;

  if (!booking?.phone || !booking?.name) {
    return new Response("Missing booking data", { status: 400 });
  }

  const phone = formatArgPhone(booking.phone);
  if (!phone) {
    console.error(`Teléfono inválido: ${booking.phone}`);
    return new Response("Invalid phone number", { status: 422 });
  }

  try {
    const message = buildMessage(booking);
    await sendWhatsApp(phone, message);
    console.log(`WhatsApp enviado a ${phone} para reserva ${booking.id}`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error enviando WhatsApp:", err);
    return new Response("Error sending WhatsApp", { status: 500 });
  }
});
