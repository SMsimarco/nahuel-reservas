/* ── CONFIG ─────────────────────────────────────── */
const SB_URL   = 'https://tzfnjozxvdnadaryyahy.supabase.co';
const SB_KEY   = 'sb_publishable_z6R0-d9ulf316kicFHFeAQ_Dw2cANhr';
const PASSWORD = 'nahuel2025';

const SPORTS = {
  padel:  { name: 'Pádel',  icon: '🏸', courts: ['Cancha A', 'Cancha B', 'Cancha C'] },
  futbol: { name: 'Fútbol', icon: '⚽', courts: ['Cancha Interior', 'Cancha Exterior'] },
};
const SLOTS = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`);

function fmt(d)   { return d.toISOString().split('T')[0]; }
function today()  { return fmt(new Date()); }
function weekEnd(){ const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return fmt(d); }

/* ── SUPABASE ───────────────────────────────────── */
const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

async function sbGet(table, qs = '') {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${qs}`, { headers });
  return r.json();
}
async function sbPost(table, data) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
  return r.json();
}
async function sbPatch(table, id, data) {
  await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
}
async function sbDelete(table, id) {
  await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers });
}
async function sbDeleteWhere(table, filter) {
  await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, { method: 'DELETE', headers });
}

/* ── LOGIN ─────────────────────────────────────── */
function doLogin() {
  if (document.getElementById('pwd-input').value === PASSWORD) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display  = 'block';
    initAdmin();
  } else {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('pwd-input').value = '';
    document.getElementById('pwd-input').focus();
  }
}
function doLogout() {
  document.getElementById('admin-panel').style.display  = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('pwd-input').value = '';
  document.getElementById('login-error').style.display = 'none';
}

/* ── TABS ───────────────────────────────────────── */
function switchTab(tab) {
  ['turnos', 'bloqueos', 'exportar'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', ['turnos', 'bloqueos', 'exportar'][i] === tab);
  });
  if (tab === 'bloqueos') renderBloqueos();
}

/* ── INIT ───────────────────────────────────────── */
async function initAdmin() {
  await renderStats();
  await renderTurnos();
  initBlockForm();
}

/* ── STATS ──────────────────────────────────────── */
async function renderStats() {
  const bks = await sbGet('bookings');
  if (!Array.isArray(bks)) { document.getElementById('stats-grid').innerHTML = ''; return; }
  const t = today();
  const hoy    = bks.filter(b => b.date === t).length;
  const semana = bks.filter(b => b.date >= t && b.date <= weekEnd()).length;
  const padel  = bks.filter(b => b.sport === 'padel'  && b.date >= t).length;
  const futbol = bks.filter(b => b.sport === 'futbol' && b.date >= t).length;
  document.getElementById('stats-grid').innerHTML =
    [['Hoy', hoy, 'turnos hoy'], ['Esta semana', semana, 'turnos totales'], ['Pádel', padel, 'próximos'], ['Fútbol', futbol, 'próximos']]
    .map(([l, v, s]) => `<div class="stat-card"><div class="stat-label">${l}</div><div class="stat-value">${v}</div><div class="stat-sub">${s}</div></div>`)
    .join('');
}

/* ── TURNOS ─────────────────────────────────────── */
let allBookings = [];

async function renderTurnos() {
  document.getElementById('turnos-body').innerHTML = '<div class="loading">Cargando...</div>';
  allBookings = await sbGet('bookings', 'order=date,time');
  if (!Array.isArray(allBookings)) allBookings = [];
  filterAndRenderTurnos();
}

function filterAndRenderTurnos() {
  const sport  = document.getElementById('filter-sport').value;
  const period = document.getElementById('filter-period').value;
  const search = document.getElementById('filter-search').value.toLowerCase();
  const t      = today();

  let bks = [...allBookings];
  if (sport)             bks = bks.filter(b => b.sport === sport);
  if (period === 'today') bks = bks.filter(b => b.date === t);
  if (period === 'week')  bks = bks.filter(b => b.date >= t && b.date <= weekEnd());
  if (search)            bks = bks.filter(b => b.name.toLowerCase().includes(search) || (b.phone || '').includes(search));

  const body = document.getElementById('turnos-body');
  if (!bks.length) {
    body.innerHTML = '<div class="empty-table"><span>📋</span>No hay turnos con esos filtros.</div>';
    return;
  }

  body.innerHTML = bks.map(b => {
    const s    = SPORTS[b.sport] || { name: b.sport };
    const dt   = new Date(b.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    const past = b.date < t;
    return `<div class="table-row cols-bookings" style="opacity:${past ? .55 : 1}">
      <span style="font-weight:700;font-size:14px">${b.time}</span>
      <span style="font-size:13px;text-transform:capitalize">${dt}</span>
      <span><span class="pill pill-${b.sport}">${s.name}</span></span>
      <span style="font-size:13px;color:var(--muted)">${b.court}</span>
      <span style="font-size:14px;font-weight:600">${b.name}</span>
      <span class="hide-mobile" style="font-size:13px;color:var(--muted)">${b.phone || ''}</span>
      <span style="display:flex;gap:6px">
        <button class="icon-btn edit"   onclick="openEditModal('${b.id}')" title="Editar">✏️</button>
        <button class="icon-btn delete" onclick="deleteBooking('${b.id}')" title="Eliminar">🗑</button>
      </span>
    </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('filter-sport').addEventListener('change', filterAndRenderTurnos);
  document.getElementById('filter-period').addEventListener('change', filterAndRenderTurnos);
  document.getElementById('filter-search').addEventListener('input',  filterAndRenderTurnos);
});

async function deleteBooking(id) {
  if (!confirm('¿Eliminás este turno?')) return;
  await sbDelete('bookings', id);
  allBookings = allBookings.filter(b => b.id !== id);
  filterAndRenderTurnos();
  renderStats();
}

/* ── EDIT MODAL ─────────────────────────────────── */
let editingId = null;

function openEditModal(id) {
  const b = allBookings.find(x => x.id === id);
  if (!b) return;
  editingId = id;

  document.getElementById('edit-name').value  = b.name;
  document.getElementById('edit-phone').value = b.phone || '';

  const timeSel = document.getElementById('edit-time');
  timeSel.innerHTML = SLOTS.map(s => `<option value="${s}" ${s === b.time ? 'selected' : ''}>${s}</option>`).join('');

  document.getElementById('edit-modal').style.display = 'flex';
}

function closeModal(e) {
  if (e.target.id === 'edit-modal') {
    document.getElementById('edit-modal').style.display = 'none';
  }
}

async function saveEdit() {
  const name  = document.getElementById('edit-name').value.trim();
  const phone = document.getElementById('edit-phone').value.trim();
  const time  = document.getElementById('edit-time').value;
  if (!name) { alert('El nombre no puede estar vacío.'); return; }

  const btn = document.querySelector('.modal-save');
  btn.textContent = 'GUARDANDO...';
  btn.disabled = true;

  await sbPatch('bookings', editingId, { name, phone, time });

  // Actualizar local
  const idx = allBookings.findIndex(b => b.id === editingId);
  if (idx > -1) { allBookings[idx] = { ...allBookings[idx], name, phone, time }; }

  document.getElementById('edit-modal').style.display = 'none';
  btn.textContent = 'GUARDAR';
  btn.disabled = false;
  filterAndRenderTurnos();
}

/* ── BLOQUEOS ───────────────────────────────────── */
function initBlockForm() {
  updateCourtSelect();
  document.getElementById('bl-date').value = today();
  document.getElementById('bl-time').innerHTML = SLOTS.map(s => `<option value="${s}">${s}</option>`).join('');
}

function updateCourtSelect() {
  const sport  = document.getElementById('bl-sport').value;
  const courts = SPORTS[sport].courts;
  document.getElementById('bl-court').innerHTML = courts.map(c => `<option value="${c}">${c}</option>`).join('');
}

async function addBlock() {
  const sport = document.getElementById('bl-sport').value;
  const court = document.getElementById('bl-court').value;
  const date  = document.getElementById('bl-date').value;
  const time  = document.getElementById('bl-time').value;
  if (!date) { alert('Seleccioná una fecha'); return; }
  await sbPost('blocks', { id: Date.now().toString(), sport, court, date, time });
  renderBloqueos();
}

async function renderBloqueos() {
  document.getElementById('bloqueos-body').innerHTML = '<div class="loading">Cargando...</div>';
  const blocks = await sbGet('blocks', 'order=date,time');
  if (!Array.isArray(blocks) || !blocks.length) {
    document.getElementById('bloqueos-body').innerHTML = '<div class="empty-table"><span>🚫</span>No hay horarios bloqueados.</div>';
    return;
  }
  document.getElementById('bloqueos-body').innerHTML = blocks.map(b => {
    const s  = SPORTS[b.sport] || { name: b.sport };
    const dt = new Date(b.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<div class="table-row" style="grid-template-columns:80px 120px 1fr 1fr 60px">
      <span style="font-weight:700">${b.time}</span>
      <span style="font-size:13px">${dt}</span>
      <span><span class="pill pill-${b.sport}">${s.name}</span></span>
      <span style="font-size:13px;color:var(--muted)">${b.court}</span>
      <span><button class="icon-btn delete" onclick="deleteBlock('${b.id}')" title="Quitar bloqueo">🗑</button></span>
    </div>`;
  }).join('');
}

async function deleteBlock(id) {
  if (!confirm('¿Quitás el bloqueo?')) return;
  await sbDelete('blocks', id);
  renderBloqueos();
}

/* ── EXPORT ─────────────────────────────────────── */
async function exportCSV(mode) {
  let bks = await sbGet('bookings', 'order=date,time');
  if (!Array.isArray(bks) || !bks.length) { alert('No hay reservas para exportar.'); return; }
  if (mode === 'today') bks = bks.filter(b => b.date === today());
  if (!bks.length) { alert('No hay reservas para hoy.'); return; }

  const header = ['Fecha', 'Hora', 'Deporte', 'Cancha', 'Titular', 'Teléfono', 'Email'].join(',');
  const rows   = bks.map(b => [
    b.date, b.time,
    (SPORTS[b.sport] || { name: b.sport }).name,
    b.court, `"${b.name}"`, b.phone || '', b.email || ''
  ].join(','));

  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `nahuel-reservas-${today()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

async function clearPast() {
  const bks = await sbGet('bookings', `date=lt.${today()}`);
  if (!Array.isArray(bks) || !bks.length) { alert('No hay reservas pasadas.'); return; }
  if (!confirm(`¿Eliminás ${bks.length} reserva${bks.length > 1 ? 's' : ''} pasada${bks.length > 1 ? 's' : ''}? No se puede deshacer.`)) return;
  await sbDeleteWhere('bookings', `date=lt.${today()}`);
  renderStats();
  renderTurnos();
  alert('Reservas pasadas eliminadas.');
}
