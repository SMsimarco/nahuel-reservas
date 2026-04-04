/* ── SUPABASE CONFIG ─────────────────────────────── */
const SB_URL = 'https://tzfnjozxvdnadaryyahy.supabase.co';
const SB_KEY = 'sb_publishable_z6R0-d9ulf316kicFHFeAQ_Dw2cANhr';

/* ── XSS PROTECTION ──────────────────────────────── */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

/* ── TOAST ───────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ── SUPABASE HELPERS ────────────────────────────── */
function getClientHeaders() {
  const token = localStorage.getItem('nahuel_client_token');
  return {
    apikey: SB_KEY,
    Authorization: `Bearer ${token ? token : SB_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
}

async function sbGet(table, filters = '') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filters}`, { headers: getClientHeaders() });
  return res.json();
}

async function sbPost(table, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: getClientHeaders(),
    body: JSON.stringify(data)
  });
  return res.json();
}

async function sbDelete(table, id) {
  await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: getClientHeaders()
  });
}

/* ── DATA ─────────────────────────────────────────── */
const SPORTS = {
  padel:  { name: 'Pádel',  icon: '🏸', courts: ['Cancha A', 'Cancha B', 'Cancha C'],    duration: 60, tag: '3 canchas · 60 min', accent: 'var(--green)', accentLight: 'var(--glight)',    accentClass: 'accent-padel' },
  futbol: { name: 'Fútbol', icon: '⚽',  courts: ['Cancha F8', 'Cancha F6', 'Cancha F5'], duration: 60, tag: '3 canchas · 60 min', accent: 'var(--blue)',  accentLight: 'var(--bluelight)', accentClass: 'accent-blue'  },
};
const SLOTS = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`);

let currentSport = null;
let selectedDate = new Date();
let wkStart      = getMonday(new Date());
let pendingSlot  = null;
let bookings     = [];
let blocks       = [];
let lastBooking  = null;

function fmt(d)  { return d.toISOString().split('T')[0]; }
function today() { return fmt(new Date()); }
function getMonday(d) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

/* ── LOAD DATA ───────────────────────────────────── */
async function loadAll() {
  try {
    [bookings, blocks] = await Promise.all([
      sbGet('bookings', 'order=date,time'),
      sbGet('blocks')
    ]);
    if (!Array.isArray(bookings)) bookings = [];
    if (!Array.isArray(blocks))   blocks   = [];
  } catch (e) {
    bookings = []; blocks = [];
  }
  updateHomeCount();
}
loadAll();
updateClubStatus();

/* ── ROUTING ─────────────────────────────────────── */
function goTo(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'view-home')       { updateHomeCount(); updateClubStatus(); }
  if (id === 'view-mis-turnos') renderBookings();
}

/* ── HOME ─────────────────────────────────────────── */
function getAvailableCount(sport) {
  if (!Array.isArray(bookings) || !Array.isArray(blocks)) return null;
  const s        = SPORTS[sport];
  const todayStr = today();
  const nowHour  = new Date().getHours();
  let count = 0;
  SLOTS.forEach(time => {
    if (parseInt(time) <= nowHour) return;
    s.courts.forEach(court => {
      const taken =
        bookings.some(b => b.court === court && b.time === time && b.date === todayStr && b.sport === sport) ||
        blocks.some(b  => b.court === court && b.time === time && b.date === todayStr && b.sport === sport);
      if (!taken) count++;
    });
  });
  return count;
}

function updateHomeCount() {
  const myId = getMyUserId();
  const n    = bookings.filter(b => b.date >= today() && b.user_id === myId).length;
  const el   = document.getElementById('home-bk-count');
  if (el) el.textContent = n === 0 ? 'Sin turnos próximos' : `${n} turno${n > 1 ? 's' : ''} próximo${n > 1 ? 's' : ''}`;

  ['padel', 'futbol'].forEach(sport => {
    const badge = document.getElementById(`avail-${sport}`);
    if (!badge) return;
    const c = getAvailableCount(sport);
    if (c === null) return;
    if (c === 0) {
      badge.textContent = 'Sin disponibilidad hoy';
      badge.className = 'avail-badge red';
    } else if (c <= 4) {
      badge.textContent = `¡Solo ${c} lugar${c > 1 ? 'es' : ''} disponible${c > 1 ? 's' : ''} hoy!`;
      badge.className = 'avail-badge orange';
    } else {
      badge.textContent = `${c} lugares disponibles hoy`;
      badge.className = 'avail-badge green';
    }
  });
}

/* ── SPORT SELECT ────────────────────────────────── */
function setSport(key) { currentSport = key; }
function selectSport(key) {
  currentSport  = key;
  selectedDate  = new Date();
  wkStart       = getMonday(new Date());
  const s       = SPORTS[key];
  document.getElementById('grid-title').textContent = s.name;
  document.getElementById('grid-sub').textContent   = s.tag;
  const hdr     = document.getElementById('grid-header');
  hdr.className = 'page-header ' + s.accentClass;
  renderDays();
  renderGrid();
  goTo('view-grid');
}

/* ── DAYS ─────────────────────────────────────────── */
function shiftWeek(dir) {
  wkStart = new Date(wkStart);
  wkStart.setDate(wkStart.getDate() + dir * 7);
  renderDays();
  renderGrid();
}

function renderDays() {
  const strip   = document.getElementById('days-scroll');
  strip.innerHTML = '';
  const s       = SPORTS[currentSport];
  const hdr     = document.getElementById('grid-header');
  hdr.className = 'page-header ' + s.accentClass;

  for (let i = 0; i < 7; i++) {
    const d    = new Date(wkStart);
    d.setDate(d.getDate() + i);
    const df   = fmt(d);
    const sel  = df === fmt(selectedDate);
    const hoy  = df === today();
    const past = df < today();
    const dayNames = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];
    const dn   = dayNames[d.getDay()];

    const btn  = document.createElement('button');
    btn.className = 'day-btn' + (sel ? ' selected' : '') + (hoy ? ' today' : '') + (past ? ' past' : '');
    btn.innerHTML =
      `<span class="dname">${dn}</span>` +
      `<span class="dnum">${d.getDate()}</span>` +
      (hoy ? `<span class="dhoy">HOY</span>` : '');
    if (!past) { btn.onclick = () => { selectedDate = d; renderDays(); renderGrid(); }; }
    strip.appendChild(btn);
  }
  document.getElementById('sel-date-label').textContent =
    selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ── GRID ─────────────────────────────────────────── */
function isBooked(court, time, date) {
  const dateStr = fmt(date);
  const booked  = bookings.some(b => b.court === court && b.time === time && b.date === dateStr && b.sport === currentSport);
  if (booked) return true;
  return blocks.some(b => b.court === court && b.time === time && b.date === dateStr && b.sport === currentSport);
}

function isPastSlot(time, date) {
  if (fmt(date) > today()) return false;
  if (fmt(date) < today()) return true;
  return parseInt(time) <= new Date().getHours();
}

function renderGrid() {
  const s      = SPORTS[currentSport];
  const wrap   = document.getElementById('grid-inner');
  const accent = currentSport === 'padel' ? 'var(--green)' : 'var(--blue)';

  const visibleSlots = SLOTS.filter(time =>
    !isPastSlot(time, selectedDate) ||
    s.courts.some(c => isBooked(c, time, selectedDate))
  );

  // Todos los horarios del día ya pasaron
  if (visibleSlots.length === 0) {
    wrap.innerHTML = `<div class="no-slots-wrap">
      <div class="no-slots-icon">📅</div>
      <div class="no-slots-title">Sin turnos para este día</div>
      <div class="no-slots-sub">Todos los horarios ya pasaron.<br>Seleccioná otro día.</div>
    </div>`;
    return;
  }

  // Hay slots visibles pero todos están tomados
  const anyAvail = visibleSlots.some(time =>
    !isPastSlot(time, selectedDate) &&
    s.courts.some(c => !isBooked(c, time, selectedDate))
  );

  if (!anyAvail) {
    wrap.innerHTML = `<div class="no-slots-wrap">
      <div class="no-slots-icon">🏟</div>
      <div class="no-slots-title">Sin disponibilidad</div>
      <div class="no-slots-sub">Todas las canchas están reservadas.<br>Probá con otro día.</div>
    </div>`;
    return;
  }

  let html = `<div class="matrix-wrap"><table class="matrix-table">`;
  html += `<thead><tr><th class="matrix-corner"></th>`;
  visibleSlots.forEach(time => { html += `<th class="matrix-hour">${time}</th>`; });
  html += `</tr></thead><tbody>`;

  s.courts.forEach(court => {
    html += `<tr><td class="matrix-court">${court}</td>`;
    visibleSlots.forEach(time => {
      const taken = isBooked(court, time, selectedDate);
      const gone  = isPastSlot(time, selectedDate);
      const avail = !taken && !gone;
      html += avail
        ? `<td class="matrix-cell avail" onclick="openForm('${court}','${time}')" style="--ac:${accent}"></td>`
        : `<td class="matrix-cell taken"></td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>
    <div class="matrix-legend">
      <div class="matrix-leg-item"><div class="matrix-leg-dot avail" style="background:${accent}"></div>Disponible</div>
      <div class="matrix-leg-item"><div class="matrix-leg-dot taken"></div>Reservado</div>
    </div></div>`;

  wrap.innerHTML = html;
}

/* ── FORM ─────────────────────────────────────────── */
function openForm(court, time) {
  // Si no está logueado, guardar contexto y redirigir al login
  if (!getMyUserId()) {
    pendingSlot = { court, time };
    localStorage.setItem('nahuel_pending_login', JSON.stringify({
      court, time, sport: currentSport, date: fmt(selectedDate)
    }));
    goTo('view-login');
    return;
  }

  pendingSlot = { court, time };
  const s     = SPORTS[currentSport];
  const sc    = document.getElementById('summary-card');
  sc.style.background      = s.accentLight;
  sc.style.borderLeftColor = s.accent;
  document.getElementById('summary-label').style.color = s.accent;
  document.getElementById('summary-label').textContent = 'DETALLE DE LA RESERVA';

  const dateStr = selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('summary-grid').innerHTML =
    [['Deporte', `${s.icon} ${s.name}`], ['Cancha', court], ['Fecha', dateStr], ['Horario', `${time} · ${s.duration} min`]]
      .map(([k, v]) => `<div><div class="summary-item-key" style="color:${s.accent}">${k}</div><div class="summary-item-val">${v}</div></div>`)
      .join('');

  // Pre-rellenar con datos guardados del usuario
  const profile = JSON.parse(localStorage.getItem('nahuel_user_profile') || 'null');
  document.getElementById('inp-name').value  = profile?.name  || '';
  document.getElementById('inp-phone').value = profile?.phone || '';
  const emailEl = document.getElementById('inp-email');
  if (emailEl) emailEl.value = profile?.email || '';

  checkForm();
  goTo('view-form');
}

function checkForm() {
  const name    = document.getElementById('inp-name').value.trim();
  const phone   = document.getElementById('inp-phone').value.replace(/\D/g, '');
  const nameOk  = name.length >= 3;
  const phoneOk = phone.length >= 8;
  document.getElementById('btn-confirm').disabled = !(nameOk && phoneOk);
}

async function confirmBooking() {
  const name  = document.getElementById('inp-name').value.trim();
  const phone = document.getElementById('inp-phone').value.trim();
  const email = document.getElementById('inp-email') ? document.getElementById('inp-email').value.trim() : '';
  if (!name || !phone) return;

  const btn       = document.getElementById('btn-confirm');
  btn.disabled    = true;
  btn.textContent = 'GUARDANDO...';

  const bk = {
    id:      crypto.randomUUID(),
    user_id: getMyUserId(),
    sport:   currentSport,
    court:   pendingSlot.court,
    time:    pendingSlot.time,
    date:    fmt(selectedDate),
    name, phone, email
  };

  try {
    await sbPost('bookings', bk);
    bookings.push(bk);
    lastBooking = bk;

    // Guardar perfil para pre-rellenar próximas reservas
    localStorage.setItem('nahuel_user_profile', JSON.stringify({ name, phone, email }));

    // Haptic feedback en mobile
    if (navigator.vibrate) navigator.vibrate(60);

    renderConfirm(bk);
    goTo('view-ok');
    updateHomeCount();
  } catch (e) {
    showToast('Error al guardar la reserva. Intentá de nuevo.', 'error');
    btn.disabled    = false;
    btn.textContent = 'CONFIRMAR RESERVA';
  }
}

function renderConfirm(bk) {
  const s    = SPORTS[bk.sport];
  const dt   = new Date(bk.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const rows = [['Titular', bk.name], ['Deporte', s.name], ['Cancha', bk.court], ['Fecha', dt], ['Horario', `${bk.time} · ${s.duration} min`], ['Teléfono', bk.phone]];
  if (bk.email) rows.push(['Email', bk.email]);
  document.getElementById('confirm-table').innerHTML =
    rows.map(([k, v], i, a) => `<div class="confirm-row" style="${i === a.length - 1 ? 'border-bottom:none' : ''}">
      <span class="confirm-key">${k}</span>
      <span class="confirm-val">${escapeHTML(String(v))}</span></div>`)
      .join('');
}

/* ── WHATSAPP SHARE ──────────────────────────────── */
function shareWhatsApp() {
  if (!lastBooking) return;
  const bk  = lastBooking;
  const s   = SPORTS[bk.sport];
  const dt  = new Date(bk.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const msg =
    `✅ *Reserva confirmada · Club Nahuel*\n\n` +
    `${s.icon} *${s.name}* · ${bk.court}\n` +
    `📅 ${dt}\n` +
    `⏰ ${bk.time} hs · ${s.duration} min\n` +
    `👤 ${bk.name}\n` +
    `📱 ${bk.phone}\n\n` +
    `_Pozos 501, Tandil_`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

/* ── MY BOOKINGS ─────────────────────────────────── */
async function renderBookings() {
  try {
    bookings = await sbGet('bookings', 'order=date,time');
    if (!Array.isArray(bookings)) bookings = [];
  } catch (e) {}

  const myId       = getMyUserId();
  const myBookings = bookings.filter(b => b.user_id === myId);

  const upcoming = myBookings.filter(b => b.date >= today()).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const past     = myBookings.filter(b => b.date <  today()).sort((a, b) => b.date.localeCompare(a.date));

  document.getElementById('mis-sub').textContent =
    `${upcoming.length} próximo${upcoming.length !== 1 ? 's' : ''} · ${past.length} finalizado${past.length !== 1 ? 's' : ''}`;

  const wrap = document.getElementById('bookings-wrap');

  if (!myBookings.length) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-emoji">📋</div>
      <div class="empty-title">SIN RESERVAS</div>
      <div class="empty-sub">Todavía no reservaste ninguna cancha.</div>
      <button class="btn-primary green btn-centered" onclick="goTo('view-home')">RESERVAR AHORA</button>
    </div>`;
    return;
  }

  let html = '';
  if (upcoming.length) {
    html += `<div class="bk-section-label">PRÓXIMOS</div>`;
    upcoming.forEach(b => { html += bkCard(b, false); });
  }
  if (past.length) {
    html += `<div class="bk-section-label">HISTORIAL</div>`;
    past.forEach(b => { html += bkCard(b, true); });
  }
  wrap.innerHTML = html;
}

function bkCard(b, isPast) {
  const s       = SPORTS[b.sport];
  const dt      = new Date(b.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const countdown = !isPast ? daysUntil(b.date) : null;
  return `<div class="booking-card ${b.sport}${isPast ? ' past' : ''}" id="bk-${b.id}">
    <div class="bk-top">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap">
          <span class="bk-sport">${s.name}</span>
          <span class="bk-court">· ${b.court}</span>
          ${isPast ? '<span class="bk-badge">Finalizado</span>' : ''}
          ${countdown ? `<span class="bk-countdown ${countdown.cls}">${countdown.label}</span>` : ''}
        </div>
        <div class="bk-date">${dt}</div>
        <div class="bk-meta">${b.time} · ${s.duration} min · ${escapeHTML(b.name)} · ${escapeHTML(b.phone)}</div>
      </div>
      ${!isPast ? `<div id="cancel-wrap-${b.id}">
        <button class="cancel-btn" onclick="askCancel('${b.id}')">Cancelar</button>
      </div>` : ''}
    </div>
  </div>`;
}

function askCancel(id) {
  document.getElementById(`cancel-wrap-${id}`).innerHTML =
    `<div class="cancel-confirm">
      <div class="cancel-ask">¿Cancelar?</div>
      <div class="cancel-row">
        <button class="btn-no"  onclick="renderBookings()">No</button>
        <button class="btn-yes" onclick="doCancel('${id}')">Sí</button>
      </div>
    </div>`;
}

async function doCancel(id) {
  await sbDelete('bookings', id);
  bookings = bookings.filter(b => b.id !== id);
  updateHomeCount();
  renderBookings();
  showToast('Reserva cancelada');
}

/* ── LOGIN ───────────────────────────────────────── */
let currentLoginEmail = '';

async function sendOTP() {
  const email = document.getElementById('client-email').value.trim();
  if (!email) return;

  document.getElementById('login-msg').textContent = 'Enviando...';

  const res = await fetch(`${SB_URL}/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: true })
  });

  if (res.ok) {
    currentLoginEmail = email;
    document.getElementById('login-step-1').classList.add('hidden');
    document.getElementById('login-step-2').classList.remove('hidden');
    document.getElementById('login-msg').textContent = 'Código enviado. Revisá tu correo (y SPAM).';
  } else {
    document.getElementById('login-msg').textContent = 'Error al enviar el código.';
  }
}

async function verifyOTP() {
  const token = document.getElementById('client-otp').value.trim();
  if (!token || token.length !== 8) {
    document.getElementById('login-msg').textContent = 'Ingresá el código de 8 dígitos.';
    return;
  }

  document.getElementById('login-msg').textContent = 'Verificando...';

  const res  = await fetch(`${SB_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: currentLoginEmail, token, type: 'email' })
  });
  const data = await res.json();

  if (data.access_token) {
    localStorage.setItem('nahuel_client_token', data.access_token);
    document.getElementById('client-email').value = '';
    document.getElementById('client-otp').value   = '';
    resetLogin();

    // Si había un turno pendiente antes del login, retomar el flujo
    const pending = JSON.parse(localStorage.getItem('nahuel_pending_login') || 'null');
    if (pending) {
      localStorage.removeItem('nahuel_pending_login');
      currentSport  = pending.sport;
      selectedDate  = new Date(pending.date + 'T12:00:00');
      wkStart       = getMonday(selectedDate);
      const s       = SPORTS[currentSport];
      document.getElementById('grid-title').textContent = s.name;
      document.getElementById('grid-sub').textContent   = s.tag;
      openForm(pending.court, pending.time);
    } else {
      goTo('view-home');
    }
    showToast('¡Sesión iniciada!');
  } else {
    document.getElementById('login-msg').textContent = 'Código incorrecto o expirado.';
  }
}

function resetLogin() {
  currentLoginEmail = '';
  document.getElementById('login-step-1').classList.remove('hidden');
  document.getElementById('login-step-2').classList.add('hidden');
  document.getElementById('login-msg').textContent = '';
}

/* ── ESTADO DEL CLUB ─────────────────────────────── */
function isClubOpen() {
  const now = new Date();
  const day = now.getDay(); // 0=Dom, 6=Sáb
  const h   = now.getHours() + now.getMinutes() / 60;
  if (day >= 1 && day <= 5) return h >= 8  && h < 22; // Lun–Vie
  if (day === 6)             return h >= 8  && h < 20; // Sáb
  if (day === 0)             return h >= 9  && h < 18; // Dom
  return false;
}

function updateClubStatus() {
  const dot  = document.getElementById('club-status-dot');
  const text = document.getElementById('club-status-text');
  if (!dot || !text) return;
  const open = isClubOpen();
  dot.className  = `club-dot ${open ? 'open' : 'closed'}`;
  text.textContent = open ? 'Abierto ahora' : 'Cerrado ahora';
  text.className = `club-status-text ${open ? 'open' : 'closed'}`;
}

/* ── DÍAS RESTANTES ──────────────────────────────── */
function daysUntil(dateStr) {
  const t    = new Date(); t.setHours(0, 0, 0, 0);
  const d    = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((d - t) / 86400000);
  if (diff === 0) return { label: 'HOY',     cls: 'badge-hoy' };
  if (diff === 1) return { label: 'MAÑANA',  cls: 'badge-manana' };
  if (diff <= 7)  return { label: `en ${diff} días`, cls: 'badge-pronto' };
  return null;
}

/* ── AUTH ────────────────────────────────────────── */
function getMyUserId() {
  const token = localStorage.getItem('nahuel_client_token');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1])).sub;
  } catch {
    return null;
  }
}
