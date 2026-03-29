/* ── SUPABASE CONFIG ─────────────────────────────── */
const SB_URL = 'https://tzfnjozxvdnadaryyahy.supabase.co';
const SB_KEY = 'sb_publishable_z6R0-d9ulf316kicFHFeAQ_Dw2cANhr';

async function sbGet(table, filters = '') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filters}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }
  });
  return res.json();
}

async function sbPost(table, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function sbDelete(table, id) {
  await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
}

/* ── DATA ─────────────────────────────────────────── */
const SPORTS = {
  padel:  { name:'Pádel',  icon:'🏸', courts:['Cancha A','Cancha B','Cancha C'],         duration:60, tag:'3 canchas · 60 min', accent:'var(--green)', accentLight:'var(--glight)', accentClass:'accent-padel' },
  futbol: { name:'Fútbol', icon:'⚽', courts:['Cancha Interior','Cancha Exterior'], duration:90, tag:'2 canchas · 90 min', accent:'var(--blue)',  accentLight:'var(--bluelight)', accentClass:'accent-blue'  },
};
const SLOTS = Array.from({length:16},(_,i)=>`${String(6+i).padStart(2,'0')}:00`);

let currentSport = null;
let selectedDate  = new Date();
let wkStart       = getMonday(new Date());
let pendingSlot   = null;
let bookings      = [];
let blocks        = [];

function fmt(d){ return d.toISOString().split('T')[0]; }
function today(){ return fmt(new Date()); }
function getMonday(d){ const x=new Date(d); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }

/* ── LOAD DATA ───────────────────────────────────── */
async function loadAll() {
  try {
    [bookings, blocks] = await Promise.all([
      sbGet('bookings', 'order=date,time'),
      sbGet('blocks')
    ]);
    if (!Array.isArray(bookings)) bookings = [];
    if (!Array.isArray(blocks))   blocks   = [];
  } catch(e) {
    bookings = []; blocks = [];
  }
  updateHomeCount();
}
loadAll();

/* ── ROUTING ─────────────────────────────────────── */
function goTo(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
  if(id==='view-home') updateHomeCount();
  if(id==='view-mis-turnos') renderBookings();
}

/* ── HOME ─────────────────────────────────────────── */
function updateHomeCount(){
  const n = bookings.filter(b=>b.date>=today()).length;
  const el = document.getElementById('home-bk-count');
  if(el) el.textContent = n===0 ? 'Sin turnos próximos' : `${n} turno${n>1?'s':''} próximo${n>1?'s':''}`;
}

/* ── SPORT SELECT ────────────────────────────────── */
function setSport(key){ currentSport=key; }
function selectSport(key){
  currentSport = key;
  selectedDate = new Date();
  wkStart = getMonday(new Date());
  const s = SPORTS[key];
  document.getElementById('grid-title').textContent = s.name;
  document.getElementById('grid-sub').textContent   = s.tag;
  const hdr = document.getElementById('grid-header');
  hdr.className = 'page-header ' + s.accentClass;
  renderDays();
  renderGrid();
  goTo('view-grid');
}

/* ── DAYS ─────────────────────────────────────────── */
function shiftWeek(dir){
  wkStart = new Date(wkStart);
  wkStart.setDate(wkStart.getDate() + dir*7);
  renderDays();
  renderGrid();
}

function renderDays(){
  const strip = document.getElementById('days-scroll');
  strip.innerHTML = '';
  const s   = SPORTS[currentSport];
  const hdr = document.getElementById('grid-header');
  hdr.className = 'page-header ' + s.accentClass;

  for(let i=0;i<7;i++){
    const d = new Date(wkStart);
    d.setDate(d.getDate()+i);
    const df   = fmt(d);
    const sel  = df===fmt(selectedDate);
    const hoy  = df===today();
    const past = df<today();
    const dayNames=['DO','LU','MA','MI','JU','VI','SA'];
    const dn   = dayNames[d.getDay()];

    const btn = document.createElement('button');
    btn.className = 'day-btn'+(sel?' selected':'')+(hoy?' today':'')+(past?' past':'');
    btn.innerHTML =
      `<span class="dname">${dn}</span>` +
      `<span class="dnum">${d.getDate()}</span>` +
      (hoy?`<span class="dhoy">HOY</span>`:'');
    if(!past){ btn.onclick=()=>{ selectedDate=d; renderDays(); renderGrid(); }; }
    strip.appendChild(btn);
  }
  document.getElementById('sel-date-label').textContent =
    selectedDate.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
}

/* ── GRID ─────────────────────────────────────────── */
function isBooked(court, time, date){
  const dateStr = fmt(date);
  const booked = bookings.some(b=>b.court===court&&b.time===time&&b.date===dateStr&&b.sport===currentSport);
  if(booked) return true;
  return blocks.some(b=>b.court===court&&b.time===time&&b.date===dateStr&&b.sport===currentSport);
}

function isPastSlot(time, date){
  if(fmt(date)>today()) return false;
  if(fmt(date)<today()) return true;
  return parseInt(time)<=new Date().getHours();
}

function renderGrid(){
  const s    = SPORTS[currentSport];
  const wrap = document.getElementById('grid-inner');
  const ncol = s.courts.length;
  const colT = `56px repeat(${ncol},1fr)`;

  let html = `<div class="grid-header" style="grid-template-columns:${colT}"><div></div>`;
  s.courts.forEach(c=>{ html+=`<div class="court-label">${c}</div>`; });
  html += '</div>';

  SLOTS.forEach(time=>{
    html += `<div class="grid-row" style="grid-template-columns:${colT}"><div class="time-label">${time}</div>`;
    s.courts.forEach(court=>{
      const taken = isBooked(court,time,selectedDate);
      const gone  = isPastSlot(time,selectedDate);
      const avail = !taken && !gone;
      const cls   = avail ? '' : 'taken';
      const label = avail ? 'Reservar' : 'Reservado';
      const click = avail ? `openForm('${court}','${time}')` : '';
      html += `<button class="slot-btn ${cls}" ${avail?'':'disabled'} ${click?`onclick="${click}"`:''}>${label}</button>`;
    });
    html += '</div>';
  });
  wrap.innerHTML = html;
}

/* ── FORM ─────────────────────────────────────────── */
function openForm(court, time){
  pendingSlot = {court, time};
  const s  = SPORTS[currentSport];
  const sc = document.getElementById('summary-card');
  sc.style.background      = s.accentLight;
  sc.style.borderLeftColor = s.accent;
  document.getElementById('summary-label').style.color = s.accent;
  document.getElementById('summary-label').textContent = 'DETALLE DE LA RESERVA';

  const dateStr = selectedDate.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  document.getElementById('summary-grid').innerHTML =
    [['Deporte',`${s.icon} ${s.name}`],['Cancha',court],['Fecha',dateStr],['Horario',`${time} · ${s.duration} min`]]
    .map(([k,v])=>`<div><div class="summary-item-key" style="color:${s.accent}">${k}</div><div class="summary-item-val">${v}</div></div>`)
    .join('');

  document.getElementById('inp-name').value  = '';
  document.getElementById('inp-phone').value = '';
  if(document.getElementById('inp-email')) document.getElementById('inp-email').value = '';
  document.getElementById('btn-confirm').disabled = true;
  goTo('view-form');
}

function checkForm(){
  const ok = document.getElementById('inp-name').value.trim() &&
             document.getElementById('inp-phone').value.trim();
  document.getElementById('btn-confirm').disabled = !ok;
}

async function confirmBooking(){
  const name  = document.getElementById('inp-name').value.trim();
  const phone = document.getElementById('inp-phone').value.trim();
  const email = document.getElementById('inp-email') ? document.getElementById('inp-email').value.trim() : '';
  if(!name||!phone) return;

  const btn = document.getElementById('btn-confirm');
  btn.disabled = true;
  btn.textContent = 'GUARDANDO...';

  const bk = {
    id:    Date.now().toString(),
    sport: currentSport,
    court: pendingSlot.court,
    time:  pendingSlot.time,
    date:  fmt(selectedDate),
    name, phone, email
  };

  try {
    await sbPost('bookings', bk);
    bookings.push(bk);
    renderConfirm(bk);
    goTo('view-ok');
  } catch(e) {
    alert('Error al guardar la reserva. Intentá de nuevo.');
    btn.disabled = false;
    btn.textContent = 'CONFIRMAR RESERVA';
  }
}

function renderConfirm(bk){
  const s  = SPORTS[bk.sport];
  const dt = new Date(bk.date+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  const rows = [['Titular',bk.name],['Deporte',s.name],['Cancha',bk.court],['Fecha',dt],['Horario',`${bk.time} · ${s.duration} min`],['Teléfono',bk.phone]];
  if(bk.email) rows.push(['Email', bk.email]);
  document.getElementById('confirm-table').innerHTML =
    rows.map(([k,v],i,a)=>`<div class="confirm-row" style="${i===a.length-1?'border-bottom:none':''}">
      <span class="confirm-key">${k}</span>
      <span class="confirm-val">${v}</span></div>`)
    .join('');
}

/* ── MY BOOKINGS ─────────────────────────────────── */
async function renderBookings(){
  // Refrescar desde Supabase
  try {
    bookings = await sbGet('bookings','order=date,time');
    if(!Array.isArray(bookings)) bookings=[];
  } catch(e){}

  const upcoming = bookings.filter(b=>b.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  const past     = bookings.filter(b=>b.date<today()).sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('mis-sub').textContent = `${upcoming.length} próximo${upcoming.length!==1?'s':''} · ${past.length} finalizado${past.length!==1?'s':''}`;

  const wrap = document.getElementById('bookings-wrap');
  if(!bookings.length){
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-emoji">📋</div>
      <div class="empty-title">SIN RESERVAS</div>
      <div class="empty-sub">Todavía no reservaste ninguna cancha.</div>
      <button class="btn-primary green" style="max-width:240px;margin:0 auto" onclick="goTo('view-home')">RESERVAR AHORA</button>
    </div>`;
    return;
  }

  let html='';
  if(upcoming.length){
    html += `<div class="bk-section-label">PRÓXIMOS</div>`;
    upcoming.forEach(b=>{ html+=bkCard(b,false); });
  }
  if(past.length){
    html += `<div class="bk-section-label">HISTORIAL</div>`;
    past.forEach(b=>{ html+=bkCard(b,true); });
  }
  wrap.innerHTML = html;
}

function bkCard(b,isPast){
  const s  = SPORTS[b.sport];
  const dt = new Date(b.date+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  return `<div class="booking-card ${b.sport}${isPast?' past':''}" id="bk-${b.id}">
    <div class="bk-top">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:5px">
          <span class="bk-sport">${s.name}</span>
          <span class="bk-court">· ${b.court}</span>
          ${isPast?'<span class="bk-badge">Finalizado</span>':''}
        </div>
        <div class="bk-date">${dt}</div>
        <div class="bk-meta">${b.time} · ${s.duration} min · ${b.name} · ${b.phone}</div>
      </div>
      ${!isPast ? `<div id="cancel-wrap-${b.id}">
        <button class="cancel-btn" onclick="askCancel('${b.id}')">Cancelar</button>
      </div>` : ''}
    </div>
  </div>`;
}

function askCancel(id){
  document.getElementById(`cancel-wrap-${id}`).innerHTML =
    `<div class="cancel-confirm">
      <div class="cancel-ask">¿Cancelar?</div>
      <div class="cancel-row">
        <button class="btn-no" onclick="renderBookings()">No</button>
        <button class="btn-yes" onclick="doCancel('${id}')">Sí</button>
      </div>
    </div>`;
}

async function doCancel(id){
  await sbDelete('bookings', id);
  bookings = bookings.filter(b=>b.id!==id);
  updateHomeCount();
  renderBookings();
}
