import { createClient } from '@supabase/supabase-js'
import './style.css'

/* ---------- Configurazione ---------- */
const env = import.meta.env
const SB_URL = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const START = { y: 2026, m: 9 } // ottobre 2026 (mese 0-based)
const MAXY = 2040
const PLACES = { 2: 'Ostia Antica', 4: 'Castel Gandolfo', 5: 'Frosinone' } // getDay()
const REFUND = [4, 5] // solo Castel Gandolfo e Frosinone
const PEOPLE = ['Alessandro', 'Andrea', 'Gabriele', 'Gianmarco']
const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const SM = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
const DOW = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']

/* ---------- Utilità data (sempre in ora locale, nessun problema di fuso) ---------- */
const $ = s => document.querySelector(s)
const p2 = n => String(n).padStart(2, '0')
const fk = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const dmy = d => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

function lessonsInRange(from, to) {
  const out = []
  for (let t = new Date(from); t <= to; t = addDays(t, 1)) {
    const dow = t.getDay()
    if (PLACES[dow]) out.push({ date: new Date(t), key: fk(t), dow, place: PLACES[dow], refund: REFUND.includes(dow) })
  }
  return out
}

/* ---------- Stato ---------- */
const sb = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null
let view = { ...START }
let rows = {}               // data 'YYYY-MM-DD' -> { date, attendance_a, attendance_g, driver }
let isAdmin = false
let loading = false, loadErr = null, loadTok = 0
let pending = 0, lastErr = '', flash = false, flashT
const failed = new Set(), dirty = new Set(), chains = {}, ver = {}

const canEdit = () => isAdmin && !loading && !loadErr

/* ---------- UI: stato e messaggi ---------- */
function status() {
  $('#status').textContent = loading ? 'Caricamento…' : pending ? 'Salvataggio…' : failed.size ? 'Non salvato'
    : flash ? 'Salvato ✓' : isAdmin ? 'Modifica attiva' : 'Sola lettura'
  renderMsg()
}

function renderMsg() {
  const m = $('#msg')
  let text = '', fn = null
  if (loadErr) { text = 'Impossibile caricare i dati: ' + loadErr; fn = () => load() }
  else if (failed.size) { text = 'Modifica non salvata: ' + lastErr; fn = retrySave }
  m.hidden = !text
  m.replaceChildren()
  if (!text) return
  const s = document.createElement('span'); s.textContent = text
  const b = document.createElement('button'); b.textContent = 'Riprova'; b.onclick = fn
  m.append(s, b)
}

/* ---------- Navigazione ---------- */
function renderNav() {
  const ys = []
  for (let y = START.y; y <= MAXY; y++) ys.push(`<option${y === view.y ? ' selected' : ''}>${y}</option>`)
  $('#ySel').innerHTML = ys.join('')
  $('#mSel').innerHTML = MONTHS.map((n, i) =>
    `<option value="${i}"${i === view.m ? ' selected' : ''}${view.y === START.y && i < START.m ? ' disabled' : ''}>${n}</option>`).join('')
  $('#prev').disabled = view.y === START.y && view.m === START.m
  $('#next').disabled = view.y === MAXY && view.m === 11
}

function go(y, m) {
  while (m < 0) { m += 12; y-- }
  while (m > 11) { m -= 12; y++ }
  if (y < START.y || (y === START.y && m < START.m)) { y = START.y; m = START.m }
  if (y > MAXY) return
  view = { y, m }
  renderNav()
  load()
}

/* ---------- Lista lezioni ---------- */
function renderList() {
  const list = $('#list')
  list.classList.toggle('lock', !canEdit() && isAdmin)
  const ls = lessonsInRange(new Date(view.y, view.m, 1), new Date(view.y, view.m + 1, 0))
  const today = fk(new Date()), dis = canEdit() ? '' : ' disabled'
  const groups = []
  let wk = ''
  for (const l of ls) {
    const mon = addDays(l.date, -((l.dow + 6) % 7)), k = fk(mon)
    if (k !== wk) {
      wk = k
      const sun = addDays(mon, 6)
      groups.push({ label: `${mon.getDate()} ${SM[mon.getMonth()]} – ${sun.getDate()} ${SM[sun.getMonth()]}`, items: [] })
    }
    groups[groups.length - 1].items.push(l)
  }
  list.innerHTML = groups.map(g => `<div class="wk">${g.label}</div><section class="card">${g.items.map(l => {
    const r = rows[l.key] || {}
    const car = l.refund ? `<label class="car${r.driver ? ' on' : ''}"><span><span class="ic">🚗</span>${r.driver ? `<em>${r.driver}</em>` : ''}</span>
      <select data-car aria-label="Rimborso carburante"${dis}><option value="">Nessuno</option>${PEOPLE.map(p => `<option${r.driver === p ? ' selected' : ''}>${p}</option>`).join('')}</select></label>` : '<span></span>'
    return `<div class="row${l.key === today ? ' today' : ''}" data-k="${l.key}">
      <div class="d"><small>${DOW[l.dow]}</small><b>${l.date.getDate()}</b></div>
      <div class="pl">${l.place}</div>
      <div class="dots">
        <button class="dot" data-f="attendance_a" aria-label="Alessandro" aria-pressed="${!!r.attendance_a}"${dis}><span>A</span></button>
        <button class="dot" data-f="attendance_g" aria-label="Gianmarco" aria-pressed="${!!r.attendance_g}"${dis}><span>G</span></button>
      </div>${car}</div>`
  }).join('')}</section>`).join('')
}

function ensure(k) {
  return (rows[k] ||= { date: k, attendance_a: false, attendance_g: false, driver: null })
}

$('#list').addEventListener('click', e => {
  const b = e.target.closest('.dot')
  if (!b || !canEdit()) return
  const k = b.closest('.row').dataset.k, r = ensure(k), f = b.dataset.f
  r[f] = !r[f]
  b.setAttribute('aria-pressed', r[f])
  persist(k)
})

$('#list').addEventListener('change', e => {
  const s = e.target.closest('select[data-car]')
  if (!s || !canEdit()) return
  const k = s.closest('.row').dataset.k, r = ensure(k)
  r.driver = s.value || null
  const lab = s.closest('.car')
  lab.classList.toggle('on', !!r.driver)
  lab.firstElementChild.innerHTML = `<span class="ic">🚗</span>${r.driver ? `<em>${r.driver}</em>` : ''}`
  persist(k)
})

/* ---------- Caricamento ---------- */
async function load(silent = false) {
  const tok = ++loadTok
  if (!silent) { loading = true; loadErr = null; renderList(); status() }
  const first = fk(new Date(view.y, view.m, 1)), last = fk(new Date(view.y, view.m + 1, 0))
  let data, error
  try { ({ data, error } = await sb.from('lessons').select('*').gte('date', first).lte('date', last)) }
  catch (e) { error = e }
  if (tok !== loadTok) return // risposta superata da una navigazione più recente
  loading = false
  if (error) { if (!silent) { loadErr = error.message || 'errore di rete' } }
  else {
    loadErr = null
    for (const r of data) if (!dirty.has(r.date)) rows[r.date] = r // non sovrascrive modifiche non ancora salvate
  }
  renderList(); status()
}

/* ---------- Salvataggio automatico ---------- */
function persist(k) {
  const v = (ver[k] = (ver[k] || 0) + 1)
  dirty.add(k); pending++; status()
  chains[k] = (chains[k] || Promise.resolve()).then(async () => {
    const r = rows[k] // sempre l'ultimo stato locale di quella data
    let error
    try {
      ({ error } = await sb.from('lessons').upsert(
        { date: k, attendance_a: r.attendance_a, attendance_g: r.attendance_g, driver: r.driver }, { onConflict: 'date' }))
    } catch (e) { error = e }
    pending--
    if (error) { failed.add(k); lastErr = /row-level|policy|JWT/i.test(error.message || '') ? 'sessione scaduta, accedi di nuovo' : (error.message || 'errore di rete') }
    else {
      failed.delete(k)
      if (ver[k] === v) dirty.delete(k)
      if (!pending && !failed.size) { flash = true; clearTimeout(flashT); flashT = setTimeout(() => { flash = false; status() }, 1500) }
    }
    status()
  })
}
const retrySave = () => [...failed].forEach(persist)

/* ---------- Autenticazione ---------- */
async function refreshAuth() {
  const { data: { session } } = await sb.auth.getSession()
  isAdmin = false
  if (session) {
    const { data } = await sb.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
    isAdmin = !!data
  }
  $('#auth').textContent = isAdmin ? 'Esci' : 'Accedi'
  renderList(); status()
}

$('#auth').onclick = async () => { if (isAdmin) await sb.auth.signOut(); else openModal('login') }
$('#lc').onclick = () => closeModal('login')
$('#lf').addEventListener('submit', async e => {
  e.preventDefault()
  const f = e.target, err = $('#le')
  err.textContent = ''
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value })
  if (error) { err.textContent = 'Credenziali non valide'; return }
  await refreshAuth()
  if (!isAdmin) { await sb.auth.signOut(); err.textContent = 'Questo account non è amministratore'; return }
  f.reset(); closeModal('login')
})

/* ---------- Export (finestra con testo + copia) ---------- */
let exportText = ''
function buildTxt(map, from, to) {
  const ls = lessonsInRange(from, to), L = []
  const st = (r, f) => !(r && (r.attendance_a || r.attendance_g)) ? 'non compilato' : r[f] ? 'presente' : 'assente'
  const cnt = { a: {}, g: {} }, ref = {}
  for (const x of ['a', 'g']) for (const s of ['presente', 'assente', 'non compilato']) cnt[x][s] = 0
  PEOPLE.forEach(p => ref[p] = 0)
  let noref = 0, cm = ''
  const now = new Date()
  L.push('REGISTRO LEZIONI DI PIANOFORTE', `Periodo: ${dmy(from)} – ${dmy(to)}`, `Generato: ${dmy(now)} ${p2(now.getHours())}:${p2(now.getMinutes())}`, '',
    'A = Alessandro   G = Gianmarco',
    'presente      = segnato presente',
    'assente       = lezione compilata (almeno un insegnante presente), ma questo insegnante no',
    'non compilato = nessuna presenza segnata per la lezione (dato mancante, non è un\'assenza)', '')
  for (const l of ls) {
    const r = map[l.key], mk = `${l.date.getFullYear()}-${l.date.getMonth()}`
    if (mk !== cm) {
      cm = mk
      if (L[L.length - 1] !== '') L.push('')
      const t = `${MONTHS[l.date.getMonth()].toUpperCase()} ${l.date.getFullYear()}`
      L.push(t, '-'.repeat(t.length))
    }
    const a = st(r, 'attendance_a'), g = st(r, 'attendance_g')
    cnt.a[a]++; cnt.g[g]++
    let line = `${DOW[l.dow]} ${p2(l.date.getDate())}/${p2(l.date.getMonth() + 1)}  ${l.place.padEnd(16)} A: ${a.padEnd(13)} G: ${g.padEnd(13)}`
    if (l.refund) {
      const d = r && r.driver
      if (d) ref[d]++; else noref++
      line += ` Rimborso: ${d || 'non indicato'}`
    }
    L.push(line.trimEnd())
  }
  const tot = ls.length, nc = cnt.a['non compilato']
  L.push('', '', 'RIEPILOGO', '---------',
    `Lezioni nel periodo: ${tot}  (compilate: ${tot - nc}, non compilate: ${nc})`, '', 'Presenze per insegnante:')
  for (const [n, x] of [['Alessandro', 'a'], ['Gianmarco', 'g']])
    L.push(`  ${n.padEnd(11)} presenze ${cnt[x].presente} · assenze ${cnt[x].assente} · non compilate ${cnt[x]['non compilato']}`)
  L.push('', 'Rimborsi carburante (Castel Gandolfo e Frosinone):')
  PEOPLE.forEach(p => L.push(`  ${p.padEnd(11)} ${ref[p]}`))
  L.push(`  ${'Non indicato'.padEnd(11)} ${noref}`)
  return L.join('\n') + '\n'
}

$('#exp').onclick = async () => {
  const btn = $('#exp')
  btn.disabled = true
  try {
    const { data, error } = await sb.from('lessons').select('*').order('date')
    if (error) throw error
    const map = {}
    data.forEach(r => map[r.date] = r)
    for (const k of dirty) map[k] = rows[k] // include modifiche locali non ancora confermate
    let to = new Date(view.y, view.m + 1, 0)
    if (data.length) {
      const [y, m] = data[data.length - 1].date.split('-').map(Number)
      const e = new Date(y, m, 0)
      if (e > to) to = e
    }
    exportText = buildTxt(map, new Date(START.y, START.m, 1), to)
    $('#xt').textContent = exportText
    $('#xk').textContent = 'COPIA'
    openModal('xm')
  } catch (e) {
    lastErr = 'export non riuscito (' + (e.message || 'errore di rete') + ')'
    failed.add('export'); status(); failed.delete('export')
  } finally { btn.disabled = false }
}

/* ---------- Finestre modali ---------- */
const openModal = id => { $('#' + id).hidden = false; if (id === 'login') setTimeout(() => $('#lf').email.focus(), 50) }
const closeModal = id => { $('#' + id).hidden = true }
document.querySelectorAll('.modal').forEach(el => el.addEventListener('click', e => { if (e.target === el) closeModal(el.id) }))
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(el => closeModal(el.id)) })
$('#xc').onclick = () => closeModal('xm')
$('#xk').onclick = async () => {
  let ok = false
  try { await navigator.clipboard.writeText(exportText); ok = true }
  catch {
    const ta = document.createElement('textarea')
    ta.value = exportText; ta.style.cssText = 'position:fixed;top:0;opacity:0;font-size:16px'
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, exportText.length)
    try { ok = document.execCommand('copy') } catch {}
    ta.remove()
  }
  $('#xk').textContent = ok ? 'COPIATO ✓' : 'COPIA MANUALE'
}

/* ---------- Avvio ---------- */
$('#prev').onclick = () => go(view.y, view.m - 1)
$('#next').onclick = () => go(view.y, view.m + 1)
$('#mSel').onchange = e => go(view.y, +e.target.value)
$('#ySel').onchange = e => go(+e.target.value, view.m)
window.addEventListener('beforeunload', e => { if (pending || failed.size) { e.preventDefault(); e.returnValue = '' } })
document.addEventListener('visibilitychange', () => { if (!document.hidden && sb && !dirty.size && !loading) load(true) })

renderNav()
if (!sb) {
  loadErr = 'variabili Supabase mancanti (vedi README)'
  renderList(); status()
} else {
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') setTimeout(refreshAuth) })
  refreshAuth().then(() => load())
}
