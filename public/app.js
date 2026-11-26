(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const TIERS = [100, 200, 300, 400, 500];
const TIME = { 100: 20, 200: 30, 300: 60, 400: 90, 500: 150 };
const TYPE_NAME = { tf: 'True / False', mc: 'Multiple choice', short: 'Identification', multi: 'Select all', label: 'Diagram labeling', blanks: 'Fill in / Solve', order: 'Sequence', explain: 'Explain' };
const MAX = { game: 8000, pop: 3000, daily: 1500 };
const KIND_NAME = { game: 'Bank Board', pop: 'Pop Quiz', daily: 'Daily Challenge' };
const AVATARS = ['🧑‍🔬', '👩‍🔬', '👨‍🔬', '🧠', '🦉', '🦊', '🐯', '🐼', '🐸', '🦄', '🚀', '🌱', '🌋', '⚡', '🧬', '🔭', '🐙', '🦖', '🐝', '🌟'];
const BADGES = {
  sharp: ['🎯', 'Sharpshooter', '10+ cards, all correct on the first try'],
  fire: ['🔥', 'On Fire', '5 correct cards in a row'],
  inferno: ['☄️', 'Unstoppable', '10 correct cards in a row'],
  perfect: ['💯', 'Perfect Topic', 'Every card in one topic correct'],
  clear: ['🏁', 'Board Cleared', 'Answered all 25 board cards'],
  speed: ['⚡', 'Speed Demon', '5 correct answers in under 10 seconds each'],
  brain: ['🧠', 'Big Brain', '3 or more $500 cards correct'],
  roller: ['🎰', 'High Roller', 'Won a Final Wager of half your bank or more'],
  pure: ['🛟', 'No Lifelines', '70%+ correct without using a lifeline'],
  flawless: ['🌟', 'Flawless', 'Every Pop Quiz / Daily question correct'],
  daily3: ['📅', 'Daily Habit', '3-day Daily Challenge streak'],
  daily7: ['🗓️', 'Week Warrior', '7-day Daily Challenge streak']
};
const manilaDay = (t = Date.now()) => new Date(t + 8 * 3600e3).toISOString().slice(0, 10);
const dayBefore = d => new Date(Date.parse(d) - 86400e3).toISOString().slice(0, 10);
const cleanCls = c => String(c || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
const hashStr = str => { let h = 1779033703; for (const ch of str) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; };
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const seededShuffle = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const signed = n => n > 0 ? '+' + money(n) : n < 0 ? '−' + money(-n) : '$0';
const TITLES = [[0.9, 'Legend'], [0.75, 'Master'], [0.55, 'Expert'], [0.35, 'Scholar'], [0.15, 'Apprentice'], [0, 'Rookie']];
const topicName = id => TOPICS.find(t => t.id === id).name;
const topicIcon = id => TOPICS.find(t => t.id === id).icon;
const money = n => '$' + Math.round(n).toLocaleString();
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const titleFor = (score, mode) => TITLES.find(([p]) => score >= p * MAX[mode])[1];

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('sbq_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sbq_' + k, JSON.stringify(v)); } catch {} }
};

/* ---------- sound ---------- */
let muted = store.get('muted', false), actx;
function tone(freqs, dur = 0.12, type = 'sine', gap = 0.09, vol = 0.18) {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * gap;
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
    });
  } catch {}
}
const sfx = {
  flip: () => tone([440, 660], 0.08, 'triangle', 0.06),
  ok: () => tone([523, 659, 784, 1047], 0.16, 'triangle', 0.08),
  bad: () => tone([220, 165], 0.25, 'sawtooth', 0.15, 0.12),
  tick: () => tone([880], 0.05, 'square', 0, 0.05),
  dd: () => tone([392, 523, 659, 784, 1047, 1319], 0.12, 'square', 0.07, 0.1),
  end: () => tone([523, 523, 784, 659, 784, 1047], 0.2, 'triangle', 0.14)
};

/* ---------- music ---------- */
let musicOn = store.get('music', true), musicId = null, musicStep = 0;
const CHORDS = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
function note(f, t, dur, type, vol) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function musicStart() {
  if (!musicOn || musicId) return;
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch { return; }
  musicId = setInterval(() => {
    const st = musicStep++, ch = CHORDS[(st >> 3) % 4], t = actx.currentTime + 0.02;
    note(ch[ARP[st % 8]] * 2, t, 0.16, 'triangle', 0.028);
    if (st % 4 === 0) note(ch[0] / 2, t, 0.35, 'sine', 0.08);
    if (st % 4 === 2) note(ch[2], t, 0.07, 'square', 0.01);
  }, 200);
}
function musicStop() { clearInterval(musicId); musicId = null; }
const syncMusicBtn = () => { const b = $('#btn-music'); b.classList.toggle('off', !musicOn); b.title = musicOn ? 'Music on' : 'Music off'; };

/* ---------- confetti ---------- */
function confetti(n = 60) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('#confetti'), g = cv.getContext('2d');
  if (!confetti.raf) { cv.width = innerWidth; cv.height = innerHeight; }
  const cols = ['#f5b82e', '#2f7a6b', '#e85d75', '#4f7cff', '#7bd389', '#ffffff'];
  confetti.ps = (confetti.ps || []).concat(Array.from({ length: n }, () => ({
    x: innerWidth * (0.15 + Math.random() * 0.7), y: innerHeight * 0.4, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5,
    r: Math.random() * 7 + 5, c: cols[Math.random() * cols.length | 0], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 })));
  if (confetti.raf) return;
  const step = () => {
    g.clearRect(0, 0, cv.width, cv.height);
    confetti.ps = confetti.ps.filter(p => p.y < cv.height + 30);
    confetti.ps.forEach(p => { p.vy += 0.4; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore(); });
    confetti.raf = confetti.ps.length ? requestAnimationFrame(step) : 0;
  };
  confetti.raf = requestAnimationFrame(step);
}

/* ---------- text matching ---------- */
function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/₂/g, '2').replace(/₄/g, '4').replace(/[’'`]/g, ' ').replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
}
const stripArticles = s => s.replace(/\b(the|a|an|it is|its|it s|is|are|called|they are)\b/g, ' ').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const tolFor = s => s.length >= 9 ? 2 : s.length >= 5 ? 1 : 0;
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasPhrase = (text, phrase) => new RegExp('(^| )' + reEsc(phrase) + '( |$)').test(text);
function shortMatch(input, acc, rej = []) {
  const n = norm(input), n2 = stripArticles(n);
  if (!n) return false;
  for (const a of acc) {
    const na = norm(a);
    if (n === na || n2 === na || lev(n2, na) <= tolFor(na)) return true;
  }
  if (rej.some(r => hasPhrase(n, norm(r)))) return false;
  return acc.some(a => hasPhrase(n, norm(a)));
}
function wordMatch(tokens, text, alt) {
  alt = alt.trim(); if (!alt) return false;
  const words = alt.split(' ');
  const pattern = words.map(w => w.endsWith('*') ? reEsc(norm(w.slice(0, -1))) + '[a-z0-9]*' : reEsc(norm(w))).join(' ');
  if (new RegExp('(^| )' + pattern + '( |$)').test(text)) return true;
  if (words.length === 1 && !alt.endsWith('*') && alt.length >= 6) return tokens.some(t => lev(t, alt) <= 1);
  if (words.length === 1 && alt.endsWith('*') && alt.length >= 7) { const p = alt.slice(0, -1); return tokens.some(t => t.length >= p.length && lev(t.slice(0, p.length), p) <= 1); }
  return false;
}
function pointHit(text, tokens, pt) {
  if (pt.rej && pt.rej.some(r => wordMatch(tokens, text, r))) return false;
  return pt.k.some(alt => alt.split(';').filter(t => t.trim()).every(term => term.split('|').some(syn => wordMatch(tokens, text, syn))));
}
function gradeExplain(input, q) {
  const text = norm(input), tokens = text.split(' ');
  const groups = q.rubric.map(g => {
    const hits = g.points.map(p => pointHit(text, tokens, p));
    const n = hits.filter(Boolean).length;
    return { g, hits, n, pass: n >= g.min };
  });
  return { ok: groups.every(x => x.pass) && text.split(' ').length >= 1, groups };
}
const parseNum = s => { const m = String(s).replace(/,/g, '.').replace(/\s/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };

/* ---------- state ---------- */
const S = { mode: store.get('mode', 'comp'), name: store.get('name', ''), avatar: store.get('avatar', AVATARS[0]), cls: store.get('cls', ''), kind: 'game', score: 0, board: [], queue: [], log: [], start: 0, card: null, practice: false, streak: 0, bestStreak: 0, life: {}, lifeUsed: 0, wager: null, review: null, day: '', dailyReplay: false, res: null, lastMisses: [] };
let lbScope = S.mode, lbMode = 'game';

function show(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); window.scrollTo(0, 0); }
function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms); }

/* ---------- leaderboard ---------- */
const lbKey = mode => mode === 'daily' ? 'daily_' + manilaDay() : mode;
const localLB = mode => store.get('lb_' + lbKey(mode), []);
function saveLocal(mode, entry) {
  const list = localLB(mode), key = entry.name.toLowerCase();
  const i = list.findIndex(e => e.name.toLowerCase() === key);
  if (i < 0) list.push(entry); else if (entry.score > list[i].score || (entry.score === list[i].score && entry.ms < list[i].ms)) list[i] = entry;
  list.sort((a, b) => b.score - a.score || a.ms - b.ms);
  store.set('lb_' + lbKey(mode), list.slice(0, 50));
  const pos = list.findIndex(e => e.name.toLowerCase() === key) + 1;
  return { rank: pos, best: list[pos - 1].score, players: list.length };
}
async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const badgeIcons = b => (Array.isArray(b) ? b : String(b || '').split(',')).filter(x => BADGES[x]).map(x => `<span title="${BADGES[x][1]}">${BADGES[x][0]}</span>`).join('');
function livePing(done) {
  if (S.mode !== 'comp' || !S.cls) return;
  const L = S.log;
  livePing.body = JSON.stringify({ cls: S.cls, name: S.name, avatar: S.avatar, kind: S.kind, score: S.score, answered: L.length, correct: L.filter(l => l.ok).length, streak: S.streak, done: !!done });
  if (livePing.t) return;
  const send = () => { livePing.t = 0; livePing.last = Date.now(); fetch('/api/live', { method: 'POST', headers: { 'content-type': 'application/json' }, body: livePing.body }).catch(() => {}); };
  const wait = 1000 - (Date.now() - (livePing.last || 0));
  if (wait > 0) livePing.t = setTimeout(send, wait); else send();
}
async function postGlobal(entry) {
  const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
function renderLB(list, mode) {
  const ol = $('#lb-list'), me = (S.name || '').toLowerCase();
  if (!list.length) { ol.innerHTML = '<li class="empty">No scores yet. Be the first! 🚀</li>'; return; }
  const medal = i => ['🥇', '🥈', '🥉'][i] || (i + 1);
  ol.innerHTML = list.slice(0, 50).map((e, i) => `<li class="${e.name.toLowerCase() === me ? 'me' : ''}">
    <span class="pos">${medal(i)}</span><span class="av">${esc(e.avatar || '🙂')}</span>
    <span class="nm">${esc(e.name)} <span class="rank-title">${titleFor(e.score, mode)}</span>${e.cls && lbScope !== 'cls' ? `<span class="cls-tag">${esc(e.cls)}</span>` : ''}<small>${e.correct}/${e.total} correct · ${fmtTime(e.ms)} <span class="bdg">${badgeIcons(e.badges)}</span></small></span>
    <span class="sc">${money(e.score)}</span></li>`).join('');
}
const fmtTime = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
function renderSections(list) {
  const ol = $('#lb-list');
  if (!list.length) { ol.innerHTML = '<li class="empty">No class scores yet. Enter a class code and play in Competition mode! 🏫</li>'; return; }
  ol.innerHTML = list.map((e, i) => `<li class="${e.cls === S.cls ? 'me' : ''}"><span class="pos">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="av">🏫</span>
    <span class="nm">${esc(e.cls)}<small>${e.players} player${e.players > 1 ? 's' : ''} · avg ${money(e.avg)} · best ${money(e.best)}</small></span><span class="sc">${money(e.total)}</span></li>`).join('');
}
let lbReq = 0;
async function loadLB() {
  const ol = $('#lb-list'), n = ++lbReq;
  if (lbScope === 'solo') return renderLB(localLB(lbMode), lbMode);
  if (lbScope === 'cls' && !S.cls) { ol.innerHTML = '<li class="empty">Type a class code (Competition mode) to see your class ranking. 🏫</li>'; return; }
  ol.innerHTML = '<li class="empty">Loading…</li>';
  const qs = 'mode=' + lbMode + (lbMode === 'daily' ? '&day=' + manilaDay() : '') + (lbScope === 'cls' ? '&cls=' + encodeURIComponent(S.cls) : '');
  try {
    if (lbScope === 'sec') { const r = await getJSON('/api/sections?' + qs); if (n === lbReq) renderSections(r.sections); }
    else { const r = await getJSON('/api/leaderboard?' + qs); if (n === lbReq) renderLB(r.entries, lbMode); }
  } catch { if (n === lbReq) ol.innerHTML = '<li class="empty">Online leaderboard unavailable right now.</li>'; }
}
function refreshWelcome() {
  const d = store.get('daily', { last: '', n: 0 }), today = manilaDay();
  const alive = d.last === today || d.last === dayBefore(today);
  $('#daily-info').textContent = (d.last === today ? '✓ played today' : '5 questions · same for everyone') + (alive && d.n ? ` · 🔥 ${d.n}-day streak` : '');
  const m = store.get('misses', []).filter(id => QUESTIONS.some(q => q.id === id));
  $('#miss-count').textContent = m.length ? `(${m.length})` : '';
  $('#btn-review').disabled = !m.length;
  $('#btn-review').title = m.length ? 'Practise the questions you got wrong' : 'No missed questions yet';
  const got = store.get('badges', []).filter(b => BADGES[b]);
  $('#my-badges').innerHTML = got.length ? '<b>My badges</b> ' + got.map(b => `<span title="${BADGES[b][1]}: ${BADGES[b][2]}">${BADGES[b][0]}</span>`).join('') : '';
}

/* ---------- welcome ---------- */
function initWelcome() {
  $('#name').value = S.name;
  const setMode = m => { S.mode = m; store.set('mode', m); $$('.mode').forEach(b => b.classList.toggle('on', b.dataset.mode === m)); $('#cls-row').hidden = m === 'solo'; };
  const avBtn = $('#avatar-btn'); avBtn.textContent = S.avatar;
  $('#avatars').innerHTML = AVATARS.map(a => `<button type="button" class="${a === S.avatar ? 'on' : ''}">${a}</button>`).join('');
  avBtn.onclick = () => { $('#avatars').hidden = !$('#avatars').hidden; };
  $$('#avatars button').forEach(b => b.onclick = () => { S.avatar = b.textContent; store.set('avatar', S.avatar); avBtn.textContent = S.avatar; $$('#avatars button').forEach(x => x.classList.toggle('on', x === b)); $('#avatars').hidden = true; });
  $('#cls').value = S.cls;
  $('#cls').onchange = () => { S.cls = cleanCls($('#cls').value); $('#cls').value = S.cls; store.set('cls', S.cls); if (lbScope === 'cls' || lbScope === 'sec') loadLB(); };
  setMode(S.mode);
  $$('.mode').forEach(b => b.onclick = () => { setMode(b.dataset.mode); lbScope = b.dataset.mode === 'solo' ? 'solo' : (S.cls ? 'cls' : 'comp'); syncTabs(); loadLB(); });
  const syncTabs = () => { $$('#lb-scope button').forEach(b => b.classList.toggle('on', b.dataset.scope === lbScope)); $$('#lb-mode button').forEach(b => b.classList.toggle('on', b.dataset.lbmode === lbMode)); };
  $$('#lb-scope button').forEach(b => b.onclick = () => { lbScope = b.dataset.scope; syncTabs(); loadLB(); });
  $$('#lb-mode button').forEach(b => b.onclick = () => { lbMode = b.dataset.lbmode; syncTabs(); loadLB(); });
  syncTabs();
  const need = () => {
    const n = $('#name').value.replace(/\s+/g, ' ').trim();
    if (n.length < 2) { $('#name-err').textContent = 'Please enter your name (at least 2 characters) to play.'; $('#name').focus(); $('#name').classList.add('shake'); setTimeout(() => $('#name').classList.remove('shake'), 400); return false; }
    $('#name-err').textContent = ''; S.name = n.slice(0, 20); store.set('name', S.name);
    S.cls = cleanCls($('#cls').value); store.set('cls', S.cls); return true;
  };
  $('#btn-game').onclick = () => need() && startGame('game');
  $('#btn-pop').onclick = () => need() && startGame('pop');
  $('#btn-daily').onclick = () => need() && startGame('daily');
  $('#btn-bank').onclick = () => openBank();
  $('#btn-review').onclick = () => startReview(store.get('misses', []));
  refreshWelcome();
  $('#name').onkeydown = e => { if (e.key === 'Enter') $('#btn-game').click(); };
  loadLB();
}

/* ---------- game ---------- */
const pool = (topic, tier, used) => QUESTIONS.filter(q => q.topic === topic && q.tier === tier && !used.has(q.id));
function dailyQueue(day) {
  const rnd = mulberry(hashStr('brainbank|' + day));
  const topics = seededShuffle(TOPICS.map(t => t.id), rnd);
  return TIERS.map((tier, i) => { const list = QUESTIONS.filter(q => q.topic === topics[i] && q.tier === tier); return { q: list[rnd() * list.length | 0], tier, done: false }; });
}
function startGame(kind) {
  let replay = false;
  if (kind === 'daily') {
    replay = store.get('daily', {}).last === manilaDay();
    if (replay && !confirm("You've already played today's Daily Challenge. Replay it for practice? (This score won't be recorded.)")) return;
  }
  S.kind = kind; S.score = 0; S.log = []; S.start = Date.now(); S.practice = false;
  S.streak = 0; S.bestStreak = 0; S.life = { fifty: 1, hint: 1, time: 1 }; S.lifeUsed = 0; S.wager = null; S.review = null;
  S.day = manilaDay(); S.dailyReplay = replay;
  $('#hud-name').textContent = S.avatar + ' ' + S.name;
  $('#hud-mode').textContent = (S.mode === 'comp' ? '🌐 Competition' + (S.cls ? ' · 🏫 ' + S.cls : '') : '📱 Individual Challenge') + ' · ' + KIND_NAME[kind] + (replay ? ' (practice)' : '');
  updateScore(false);
  const used = new Set();
  if (kind === 'game') {
    S.board = TOPICS.map(t => TIERS.map(tier => { const q = shuffle(pool(t.id, tier, used))[0]; used.add(q.id); return { q, tier, done: false }; }));
    const ddCells = S.board.flat().filter(c => c.tier >= 300);
    shuffle(ddCells)[0].dd = true;
    renderBoard();
    $('#board').hidden = false;
  } else {
    S.queue = kind === 'daily' ? dailyQueue(S.day) : shuffle(TIERS.flatMap(tier => shuffle(QUESTIONS.filter(q => q.tier === tier)).slice(0, 2).map(q => ({ q, tier, done: false }))));
    S.qi = 0;
    renderPop();
  }
  show('scr-board');
  musicStart(); livePing(false);
  if (kind !== 'game') setTimeout(() => openCard(S.queue[0]), 250);
}
function updateScore(bump = true) {
  const b = $('#hud-score'); b.textContent = money(S.score);
  if (bump) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  const left = S.kind === 'game' ? S.board.flat().filter(c => !c.done).length : S.queue.length - S.qi;
  $('#hud-left').textContent = left + (S.kind === 'game' ? ' cards left' : ' questions left');
  const sk = $('#hud-streak'); sk.hidden = S.streak < 2;
  sk.textContent = '🔥 ' + S.streak + (S.streak >= 5 ? ' · +25%' : S.streak >= 3 ? ' · +10%' : '');
}
function renderBoard() {
  $('#board').innerHTML = TOPICS.map((t, ti) => `<div class="col"><div class="col-h"><span class="ic">${t.icon}</span>${t.name}</div>
    ${S.board[ti].map((c, i) => `<div class="tile ${c.done ? 'done ' + (c.earned > 0 ? 'ok' : 'bad') : ''}"><button data-t="${ti}" data-i="${i}" ${c.done ? 'disabled' : ''} aria-label="${t.name} for ${c.tier} dollars">
      ${c.done ? (c.earned > 0 ? '+' + money(c.earned) : '$0') : money(c.tier) + `<small>${TYPE_NAME[c.q.type]}</small>`}</button></div>`).join('')}</div>`).join('');
  $$('#board .tile button').forEach(b => b.onclick = () => openCard(S.board[b.dataset.t][b.dataset.i]));
}

function renderPop() {
  const head = S.kind === 'daily' ? `<h2>📅 Daily Challenge</h2><p>${S.day} · 5 questions · the same for everyone today</p>` : '<h2>⏱️ Pop Quiz</h2><p>10 random questions · 2 from every value tier</p>';
  $('#board').innerHTML = `<div class="pop">${head}<div class="pop-steps">${S.queue.map((c, i) =>
    `<div class="ps ${c.done ? (c.earned > 0 ? 'ok' : 'bad') : i === S.qi ? 'cur' : ''}"><b>${i + 1}</b><span>${c.done ? (c.earned > 0 ? '+' + money(c.earned) : '$0') : money(c.tier)}</span></div>`).join('')}</div>
    ${S.qi < S.queue.length ? '<button class="btn big gold" id="pop-resume">Continue quiz →</button>' : ''}</div>`;
  const r = $('#pop-resume'); if (r) r.onclick = () => openCard(S.queue[S.qi]);
}
function renderWager() {
  const used = new Set(S.board.flat().map(c => c.q.id));
  const q = shuffle(QUESTIONS.filter(x => x.tier === 500 && !used.has(x.id)))[0];
  if (!q) return endGame();
  const max = S.score;
  S.wager = { q, bet: Math.round(max / 2) };
  $('#board').innerHTML = `<div class="pop wager"><h2>💰 Final Wager</h2><p>Board cleared! One last $500-level question from:</p>
    <div class="wager-topic">${topicIcon(q.topic)} ${topicName(q.topic)} · ${TYPE_NAME[q.type]}</div>
    <p>Bet any part of your bank of <b>${money(max)}</b>. Correct = win your bet. Wrong = lose it. <b>One try only.</b></p>
    <div class="wager-bet" id="w-bet">${money(S.wager.bet)}</div>
    <input type="range" id="w-range" min="0" max="${max}" step="10" value="${S.wager.bet}" aria-label="Wager amount">
    <div class="play-row"><button class="btn small ghost" data-p="0.25">25%</button><button class="btn small ghost" data-p="0.5">50%</button><button class="btn small gold" data-p="1">All in!</button></div>
    <div class="play-row"><button class="btn big gold" id="w-go">🔒 Lock in bet</button><button class="btn big ghost" id="w-skip">Skip &amp; finish</button></div></div>`;
  const set = v => { S.wager.bet = Math.max(0, Math.min(max, Math.round(v))); $('#w-range').value = S.wager.bet; $('#w-bet').textContent = money(S.wager.bet); };
  $('#w-range').oninput = e => set(+e.target.value);
  $$('.wager [data-p]').forEach(b => b.onclick = () => set(max * +b.dataset.p));
  $('#w-go').onclick = () => { if (!S.wager.bet) return toast('Bet at least $1, or skip.'); openCard({ q, tier: 500, final: true, wager: S.wager.bet, done: false }); };
  $('#w-skip').onclick = () => endGame();
  sfx.dd(); updateScore(false);
}
function startReview(ids) {
  ids = [...new Set(ids)].filter(id => QUESTIONS.some(q => q.id === id));
  if (!ids.length) return toast('No missed questions to practise. 🎉');
  musicStop(); stopTimer();
  S.log = []; S.review = { queue: shuffle(ids), mastered: 0, total: ids.length, last: null };
  $('#hud-name').textContent = S.avatar + ' ' + (S.name || 'Player');
  $('#hud-mode').textContent = '🔁 Review my misses · practice (not scored)';
  $('#hud-streak').hidden = true;
  show('scr-board'); drawReview();
  setTimeout(() => openCard({ q: QUESTIONS.find(q => q.id === S.review.queue[0]), tier: 0 }, true), 250);
}
function drawReview() {
  const R = S.review;
  $('#board').innerHTML = `<div class="pop"><h2>🔁 Review my misses</h2><p>Get each one right to master it. Missed ones come back at the end.</p>
    <div class="review-bar"><i style="width:${R.mastered / R.total * 100}%"></i></div><p><b>${R.mastered}</b> of <b>${R.total}</b> mastered</p>
    ${R.queue.length ? '<button class="btn big gold" id="rv-go">Continue →</button>' : '<h3>🎉 All mastered! Great work.</h3><button class="btn big gold" id="rv-done">Back to Home</button>'}</div>`;
  $('#hud-score').textContent = R.mastered + '/' + R.total;
  $('#hud-left').textContent = R.queue.length + ' to go';
  const go = $('#rv-go'); if (go) go.onclick = () => openCard({ q: QUESTIONS.find(q => q.id === R.queue[0]), tier: 0 }, true);
  const done = $('#rv-done'); if (done) done.onclick = endReview;
}
function reviewNext() {
  const R = S.review;
  if (R.last !== null) { const id = R.queue.shift(); if (R.last) R.mastered++; else R.queue.push(id); R.last = null; }
  drawReview();
  if (!R.queue.length) { confetti(180); sfx.end(); return; }
  setTimeout(() => openCard({ q: QUESTIONS.find(q => q.id === R.queue[0]), tier: 0 }, true), 200);
}
function endReview() { stopTimer(); $('#modal').hidden = true; S.card = null; S.review = null; $('#btn-home').click(); }
function quitGame() {
  if (S.review) return endReview();
  if (S.log.length && !confirm(`Quit to Home? This game (${money(S.score)}) will NOT be recorded. Use Finish to record your score.`)) return;
  stopTimer(); $('#modal').hidden = true; S.card = null; S.log = [];
  $('#btn-home').click();
}

/* ---------- card ---------- */
let timerId = null;
const isLetterChoices = q => q.choices && q.choices.every(c => c.length <= 3);
const maxTries = q => q.type === 'tf' || (q.type === 'mc' && q.choices.length <= 2) ? 1 : 3;
const triesFor = c => c.cell.final ? 1 : maxTries(c.q);

function openCard(cell, practice = false) {
  const q = cell.q;
  S.practice = practice;
  const base = cell.final ? cell.wager : practice ? q.tier : cell.tier * (cell.dd ? 2 : 1);
  S.card = { cell, q, base, tries: 0, value: base, over: false, state: {}, opened: Date.now() };
  sfx.flip();
  $('#c-topic').textContent = topicIcon(q.topic) + ' ' + topicName(q.topic);
  $('#c-type').textContent = TYPE_NAME[q.type];
  $('#c-dd').hidden = practice || !(cell.dd || cell.final);
  $('#c-dd').textContent = cell.final ? `💰 FINAL WAGER · ${money(cell.wager)} 💰` : '💥 DOUBLE DOWN! 💥';
  const pop = S.kind !== 'game' && !practice;
  $('#c-home').hidden = !(pop || S.review || (cell.final && !practice)); $('#c-prog').hidden = !pop;
  $('#c-life').hidden = practice; $('#c-hint').hidden = true;
  if (pop) $('#c-prog').textContent = `Q${S.qi + 1}/${S.queue.length} · Bank ${money(S.score)}`;
  if (cell.dd && !practice) sfx.dd();
  $('#c-q').textContent = q.q;
  const img = $('#c-img');
  if (q.img) { img.src = q.img; img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); }
  $('#c-feedback').hidden = true; $('#c-feedback').className = 'feedback';
  $('#c-submit').hidden = false; $('#c-submit').disabled = false; $('#c-next').hidden = true;
  $('#c-forfeit').hidden = false; $('#c-forfeit').textContent = practice ? '👀 Show answer' : '🏳️ Forfeit';
  renderBody(q);
  renderValue(); drawLife();
  $('#modal').hidden = false;
  $('.card-box').scrollTop = 0;
  startTimer();
  const first = $('#c-body input, #c-body textarea'); if (first && matchMedia('(pointer:fine)').matches) setTimeout(() => first.focus(), 300);
}
function renderValue() {
  const c = S.card;
  $('#c-value').innerHTML = (c.value < c.base ? `<s>${money(c.base)}</s>` : '') + money(c.value) + (S.practice ? ' <small style="font-size:.8rem;color:#667">practice</small>' : '');
  const mt = triesFor(c);
  $('#c-tries').textContent = c.over ? '' : mt === 1 ? 'One try only!' : `Try ${c.tries + 1} of ${mt}`;
}
function startTimer() {
  stopTimer();
  const c = S.card; c.total = TIME[c.q.tier]; c.left = c.total;
  const bar = $('#c-timer'), box = $('.timer');
  const draw = () => { bar.style.transform = `scaleX(${Math.min(1, c.left / c.total)})`; $('#c-time').textContent = c.left + 's'; box.classList.toggle('low', c.left <= 5); };
  bar.style.transition = 'none'; draw(); void bar.offsetWidth; bar.style.transition = '';
  timerId = setInterval(() => {
    c.left--; draw();
    if (c.left > 0 && c.left <= 5) sfx.tick();
    if (c.left <= 0) { stopTimer(); wrong('⏰ Time\'s up!'); }
  }, 1000);
}
function stopTimer() { clearInterval(timerId); timerId = null; }

/* ---------- lifelines ---------- */
const liveWrongs = () => { const q = S.card.q; return q.choices.map((_, i) => i).filter(i => (q.type === 'mc' ? i !== q.answer : !q.answers.includes(i)) && !$(`#c-body .opt[data-i="${i}"]`).disabled); };
function lifeOK(k) {
  const c = S.card, q = c.q;
  if (k === 'time') return true;
  if (k === 'fifty') return !c.state.cut && ((q.type === 'mc' && liveWrongs().length >= 2) || (q.type === 'multi' && liveWrongs().length >= 2));
  if (k === 'hint') return ['short', 'explain', 'label', 'blanks', 'order', 'multi'].includes(q.type);
}
function drawLife() {
  const c = S.card;
  $$('#c-life .life').forEach(b => { const k = b.dataset.life, used = !S.life[k]; b.classList.toggle('used', used); b.disabled = c.over || used || !lifeOK(k); });
}
function useLife(k) {
  const c = S.card; if (!c || c.over || S.practice || !S.life[k] || !lifeOK(k)) return;
  const q = c.q, st = c.state;
  S.life[k] = 0; S.lifeUsed++; sfx.flip();
  if (k === 'time') { c.left += 30; c.total += 30; $('#c-time').textContent = c.left + 's'; toast('⏳ +30 seconds!'); }
  if (k === 'fifty') {
    st.cut = true;
    const w = liveWrongs(), n = q.type === 'mc' ? w.length - 1 : Math.min(w.length - 1, Math.ceil(w.length / 2));
    shuffle(w).slice(0, n).forEach(i => { const b = $(`#c-body .opt[data-i="${i}"]`); b.disabled = true; b.classList.add('cut'); b.classList.remove('sel'); if (st.v === i) st.v = undefined; if (st.sel) st.sel.delete(i); });
    toast(`✂️ Removed ${n} wrong option${n > 1 ? 's' : ''}`);
  }
  if (k === 'hint') showHint();
  drawLife();
}
function showHint() {
  const c = S.card, q = c.q, st = c.state; let h = '';
  if (q.type === 'short') { const a = q.acc[0]; h = `Starts with “${a[0].toUpperCase()}” · ${a.replace(/[^A-Za-z0-9]/g, '').length} letters${a.trim().includes(' ') ? ' · ' + a.trim().split(/\s+/).length + ' words' : ''}`; }
  else if (q.type === 'explain') { const pts = q.rubric.flatMap(g => g.points.map(p => (g.name ? g.name + ': ' : '') + p.t)); h = 'Include this idea → ' + pts[Math.random() * pts.length | 0]; }
  else if (q.type === 'label') {
    const sels = $$('#c-body .field select'), open = q.labels.map((_, i) => i).filter(i => !sels[i].disabled && sels[i].value !== q.labels[i][1]);
    const i = open.length ? open[Math.random() * open.length | 0] : 0;
    sels[i].value = q.labels[i][1]; sels[i].disabled = true; sels[i].closest('.field').classList.add('hinted');
    h = `Letter ${q.labels[i][0]} is “${q.labels[i][1]}”.`;
  } else if (q.type === 'blanks') {
    const els = $$('#c-body .field').map(f => f.querySelector('select,input'));
    let i = q.fields.findIndex((f, j) => !els[j].disabled); if (i < 0) i = 0;
    const f = q.fields[i], v = f.kind === 'select' ? f.answer : f.kind === 'num' ? String(f.value) : f.a;
    els[i].value = v; els[i].disabled = true; els[i].closest('.field').classList.add('hinted');
    h = `Filled in “${f.label}” for you.`;
  } else if (q.type === 'order') {
    let k = 0; while (k < st.seq.length && st.seq[k] === k) k++;
    if (k >= q.steps.length) k = 0;
    st.seq = st.seq.slice(0, k).concat(k); st.draw();
    h = `Step ${k + 1} is: “${q.steps[k]}”`;
  } else if (q.type === 'multi') {
    const opts = q.answers.filter(i => !st.sel.has(i)), i = opts.length ? opts[Math.random() * opts.length | 0] : q.answers[0];
    st.sel.add(i); const b = $(`#c-body .opt[data-i="${i}"]`); b.classList.add('sel', 'hinted'); b.disabled = true;
    h = `“${q.choices[i]}” is one of the correct answers.`;
  }
  $('#c-hint').innerHTML = '💡 ' + esc(h); $('#c-hint').hidden = false;
}

function renderBody(q) {
  const body = $('#c-body'), st = S.card.state;
  body.innerHTML = '';
  if (q.type === 'tf') {
    body.innerHTML = `<div class="opts"><button class="opt" data-v="true">✅ True</button><button class="opt" data-v="false">❌ False</button></div>`;
    $$('#c-body .opt').forEach(b => b.onclick = () => { $$('#c-body .opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); st.v = b.dataset.v === 'true'; });
  } else if (q.type === 'mc') {
    st.order = isLetterChoices(q) ? q.choices.map((_, i) => i) : shuffle(q.choices.map((_, i) => i));
    body.innerHTML = `<div class="opts ${isLetterChoices(q) ? 'letters' : ''}">${st.order.map(i => `<button class="opt" data-i="${i}">${esc(q.choices[i])}</button>`).join('')}</div>`;
    $$('#c-body .opt').forEach(b => b.onclick = () => { if (b.disabled) return; $$('#c-body .opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); st.v = +b.dataset.i; });
  } else if (q.type === 'multi') {
    st.sel = new Set(); st.order = shuffle(q.choices.map((_, i) => i));
    body.innerHTML = `<p class="hint">Select ALL correct answers, then submit.</p><div class="opts">${st.order.map(i => `<button class="opt" data-i="${i}"><span class="box"></span>${esc(q.choices[i])}</button>`).join('')}</div>`;
    $$('#c-body .opt').forEach(b => b.onclick = () => { const i = +b.dataset.i; st.sel.has(i) ? st.sel.delete(i) : st.sel.add(i); b.classList.toggle('sel'); });
  } else if (q.type === 'short') {
    body.innerHTML = `<input type="text" id="ans" placeholder="Type your answer…" autocomplete="off" autocapitalize="off" spellcheck="false">`;
    $('#ans').onkeydown = e => { if (e.key === 'Enter') submit(); };
  } else if (q.type === 'explain') {
    const need = q.rubric.map(g => g.min).reduce((a, b) => a + b, 0);
    body.innerHTML = `<textarea id="ans" placeholder="Explain your answer in full sentences…"></textarea><p class="hint">Auto-marked: include the key science ideas (about ${need} needed). Spelling is forgiven a little.</p>`;
  } else if (q.type === 'label') {
    const opts = shuffle(q.labels.map(l => l[1]));
    body.innerHTML = `<p class="hint">Choose the correct name for each letter.</p>` + q.labels.map(([k], i) => `<div class="field" data-i="${i}"><label>${k}</label><select><option value="">— choose —</option>${opts.map(o => `<option>${esc(o)}</option>`).join('')}</select><span class="mark"></span></div>`).join('');
  } else if (q.type === 'blanks') {
    body.innerHTML = q.fields.map((f, i) => `<div class="field" data-i="${i}"><label>${esc(f.label)}</label>${f.kind === 'select'
      ? `<select><option value="">— choose —</option>${(f.options.length > 2 ? shuffle(f.options) : f.options).map(o => `<option>${esc(o)}</option>`).join('')}</select>`
      : `<input type="text" ${f.kind === 'num' ? 'inputmode="decimal"' : ''} placeholder="${f.kind === 'num' ? 'number' + (f.unit ? ' (' + esc(f.unit) + ')' : '') : 'answer'}" autocomplete="off">`}<span class="mark"></span></div>`).join('');
  } else if (q.type === 'order') {
    st.seq = []; st.pool = shuffle(q.steps.map((_, i) => i));
    body.innerHTML = `<div class="order-seq" id="seq"></div><div style="display:flex;justify-content:space-between;align-items:center"><p class="hint">Tap a step to add it; tap a placed step to remove it.</p><button class="btn small ghost" id="seq-reset">Reset</button></div><div class="order-pool" id="pool"></div>`;
    const draw = () => {
      $('#seq').innerHTML = st.seq.map((i, n) => `<button class="step" data-i="${i}"><b>${n + 1}.</b>${esc(q.steps[i])}</button>`).join('');
      $('#pool').innerHTML = st.pool.filter(i => !st.seq.includes(i)).map(i => `<button class="step" data-i="${i}">${esc(q.steps[i])}</button>`).join('');
      $$('#seq .step').forEach(b => b.onclick = () => { if (S.card.over) return; st.seq = st.seq.filter(x => x !== +b.dataset.i); draw(); });
      $$('#pool .step').forEach(b => b.onclick = () => { if (S.card.over) return; st.seq.push(+b.dataset.i); draw(); });
    };
    st.draw = draw; draw();
    $('#seq-reset').onclick = () => { if (!S.card.over) { st.seq = []; draw(); } };
  }
}

function check() {
  const c = S.card, q = c.q, st = c.state;
  switch (q.type) {
    case 'tf': if (st.v === undefined) return null; return { ok: st.v === q.answer };
    case 'mc': if (st.v === undefined) return null; return { ok: st.v === q.answer, pick: st.v };
    case 'multi': if (!st.sel.size) return null; return { ok: st.sel.size === q.answers.length && q.answers.every(a => st.sel.has(a)) };
    case 'short': { const v = $('#ans').value; if (!v.trim()) return null; return { ok: shortMatch(v, q.acc, q.rej) }; }
    case 'explain': { const v = $('#ans').value; if (v.trim().length < 2) return null; return gradeExplain(v, q); }
    case 'label': {
      const vals = $$('#c-body .field select').map(s => s.value);
      if (vals.some(v => !v)) return { incomplete: 'Choose a label for every letter.' };
      const marks = vals.map((v, i) => v === q.labels[i][1]); return { ok: marks.every(Boolean), marks };
    }
    case 'blanks': {
      const els = $$('#c-body .field').map(f => f.querySelector('select,input'));
      if (els.some(e => !e.value.trim())) return { incomplete: 'Fill in every blank.' };
      const marks = q.fields.map((f, i) => {
        const v = els[i].value;
        if (f.kind === 'select') return v === f.answer;
        if (f.kind === 'num') { const n = parseNum(v); return Math.abs(n - f.value) <= (f.tol || 0) + 1e-9; }
        return shortMatch(v, f.acc, f.rej);
      });
      return { ok: marks.every(Boolean), marks };
    }
    case 'order': if (st.seq.length < q.steps.length) return { incomplete: 'Place all the steps first.' }; return { ok: st.seq.every((v, i) => v === i) };
  }
}
function submit() {
  const c = S.card; if (!c || c.over) return;
  const r = check();
  if (!r) { toast('Answer first! ✏️'); return; }
  if (r.incomplete) { toast(r.incomplete); return; }
  c.last = r;
  if (r.marks) $$('#c-body .field').forEach((f, i) => { f.classList.toggle('ok', r.marks[i]); f.classList.toggle('bad', !r.marks[i]); f.querySelector('.mark').textContent = r.marks[i] ? '✅' : '❌'; });
  if (r.ok) right(); else wrong();
}
function right() {
  const c = S.card; stopTimer(); c.over = true;
  let earned = c.value, extra = '';
  if (!S.practice && !c.cell.final) {
    S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
    const pct = S.streak >= 5 ? 25 : S.streak >= 3 ? 10 : 0;
    if (pct) { const b = Math.round(earned * pct / 100); earned += b; extra = `<div class="streak-msg">🔥 ${S.streak} in a row! +${pct}% streak bonus (+${money(b)})</div>`; }
  }
  sfx.ok(); confetti(S.streak >= 5 || c.cell.final ? 160 : 50);
  let html = `<h4>✅ Correct! ${S.practice ? '' : '+' + money(earned)}</h4>${extra}`;
  html += explainExtra(true);
  finishCard(earned, html, 'ok');
}
function wrong(reason) {
  const c = S.card, q = c.q;
  c.tries++;
  sfx.bad();
  const box = $('.card-box'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  if (q.type === 'mc' && c.last && c.last.pick !== undefined && !reason) {
    const b = $(`#c-body .opt[data-i="${c.last.pick}"]`); if (b) { b.classList.add('wrong'); b.classList.remove('sel'); b.disabled = true; }
    c.state.v = undefined;
  }
  if (c.tries >= triesFor(c)) {
    stopTimer(); c.over = true;
    const lose = c.cell.final && !S.practice ? c.base : 0;
    const html = `<h4>❌ ${reason || 'Wrong'} — ${lose ? 'you lose ' + money(lose) : 'card is now worth $0'}</h4>${explainExtra(false)}`;
    finishCard(-lose, html, 'bad');
    return;
  }
  c.value = Math.floor(c.base / Math.pow(2, c.tries));
  let msg = `<h4>❌ ${reason || 'Wrong!'} Card value halved to ${money(c.value)}.</h4>Try again — ${triesFor(c) - c.tries} ${triesFor(c) - c.tries === 1 ? 'try' : 'tries'} left.`;
  if (q.type === 'explain' && c.last && c.last.groups) {
    const got = c.last.groups.reduce((a, g) => a + Math.min(g.n, g.g.min), 0), need = q.rubric.reduce((a, g) => a + g.min, 0);
    msg += `<br>You covered <b>${got} of ${need}</b> key ideas needed. Add more detail.`;
  }
  if (q.type === 'multi') msg += ' (Check every option carefully.)';
  if (q.type === 'order') msg += ' (Check the order of the steps.)';
  const fb = $('#c-feedback'); fb.className = 'feedback bad'; fb.innerHTML = msg; fb.hidden = false;
  c.last = null;
  renderValue();
  startTimer();
}
function forfeit() {
  const c = S.card; if (!c || c.over) return;
  if (!S.practice && !confirm('Forfeit this card? You get $0 and the answer is shown.')) return;
  stopTimer(); c.over = true; c.last = null;
  sfx.bad();
  finishCard(0, `<h4>🏳️ ${S.practice ? 'Answer' : 'Forfeited — $0'}</h4>${explainExtra(false)}`, S.practice ? 'reveal' : 'bad');
}
function answerHTML(q) {
  switch (q.type) {
    case 'tf': return `<b>${q.answer ? 'TRUE' : 'FALSE'}</b>`;
    case 'mc': return `<b>${esc(q.choices[q.answer])}</b>`;
    case 'multi': return q.answers.map(i => '• ' + esc(q.choices[i])).join('<br>');
    case 'short': return `<b>${esc(q.a)}</b>`;
    case 'label': return q.labels.map(([k, v]) => `<b>${k}</b> – ${esc(v)}`).join('<br>');
    case 'blanks': return q.fields.map(f => `${esc(f.label)}: <b>${esc(f.kind === 'num' ? f.value + ' ' + (f.unit || '') : f.kind === 'select' ? f.answer : f.a)}</b>`).join('<br>');
    case 'order': return q.steps.map((s, i) => `${i + 1}. ${esc(s)}`).join('<br>');
    case 'explain': return esc(q.model);
  }
}
const answerText = q => answerHTML(q).replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
function explainExtra(ok) {
  const c = S.card, q = c.q; let h = '';
  if (q.type === 'explain' && c.last && c.last.groups) {
    h += '<ul>' + c.last.groups.map(g => g.g.points.map((p, i) => `<li class="${g.hits[i] ? 'hit' : 'miss'}">${g.hits[i] ? '✔' : '✘'} ${g.g.name ? '<b>' + esc(g.g.name) + ':</b> ' : ''}${esc(p.t)}</li>`).join('')).join('') + '</ul>';
  }
  h += `<div class="model">${ok && q.type !== 'explain' ? '' : (q.type === 'explain' ? 'Model answer: ' : 'Answer: ')}${ok && q.type !== 'explain' ? (q.why ? esc(q.why) : answerHTML(q)) : answerHTML(q)}${!ok && q.why ? '<br><i>' + esc(q.why) + '</i>' : ''}</div>`;
  if (q.revealImg) h += `<img src="${q.revealImg}" alt="Answer diagram">`;
  if (q.type === 'mc' && !ok) { const b = $(`#c-body .opt[data-i="${q.answer}"]`); if (b) b.classList.add('right'); }
  if (q.src === 'added') h += '<p class="hint" style="margin-top:6px">Answer key prepared for this reviewer (not on the original slide).</p>';
  return h;
}
function finishCard(earned, html, cls) {
  const c = S.card, fb = $('#c-feedback');
  fb.className = 'feedback ' + cls; fb.innerHTML = html; fb.hidden = false;
  $('#c-submit').hidden = true; $('#c-forfeit').hidden = true; $('#c-next').hidden = false;
  $$('#c-body button, #c-body input, #c-body textarea, #c-body select').forEach(e => { if (!e.classList.contains('step')) e.disabled = true; });
  renderValue(); drawLife();
  $('#c-value').innerHTML = S.practice ? (earned > 0 ? '✅' : '❌') : signed(earned);
  if (!S.practice) {
    c.cell.done = true; c.cell.earned = earned;
    S.score = Math.max(0, S.score + earned);
    if (earned <= 0) S.streak = 0;
    S.log.push({ q: c.q, earned, tier: c.cell.tier, ok: earned > 0, tries: c.tries + (earned > 0 ? 1 : 0), ms: Date.now() - c.opened, final: !!c.cell.final, wager: c.cell.wager });
    trackMiss(c.q.id, earned > 0);
    updateScore(earned > 0); livePing(false);
  } else {
    if (earned > 0) trackMiss(c.q.id, true);
    if (S.review) S.review.last = earned > 0;
  }
  setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  $('#c-next').focus({ preventScroll: true });
}
function trackMiss(id, ok) { const m = store.get('misses', []).filter(x => x !== id); if (!ok) m.unshift(id); store.set('misses', m.slice(0, 120)); }
function nextCard() {
  $('#modal').hidden = true; stopTimer();
  const c = S.card; S.card = null;
  if (S.practice) { if (S.review) reviewNext(); return; }
  if (c && c.cell.final) return endGame();
  if (S.kind === 'game') { renderBoard(); if (S.board.flat().every(x => x.done)) { if (S.score > 0 && !S.wager) renderWager(); else endGame(); } }
  else { S.qi++; updateScore(false); renderPop(); if (S.qi >= S.queue.length) endGame(); else setTimeout(() => openCard(S.queue[S.qi]), 200); }
}

/* ---------- results ---------- */
function computeBadges() {
  const L = S.log, ok = L.filter(l => l.ok), b = [];
  if (L.length >= 10 && L.every(l => l.ok && l.tries === 1)) b.push('sharp');
  if (S.bestStreak >= 5) b.push('fire');
  if (S.bestStreak >= 10) b.push('inferno');
  if (S.kind === 'game') {
    if (S.board.some(col => col.every(c => c.done && c.earned > 0))) b.push('perfect');
    if (S.board.flat().every(c => c.done)) b.push('clear');
  }
  if (ok.filter(l => l.ms < 10000).length >= 5) b.push('speed');
  if (ok.filter(l => l.tier === 500).length >= 3) b.push('brain');
  const fin = L.find(l => l.final);
  if (fin && fin.ok && fin.wager >= (S.score - fin.earned) / 2) b.push('roller');
  if (L.length >= 5 && !S.lifeUsed && ok.length / L.length >= 0.7) b.push('pure');
  if (S.kind !== 'game' && L.length >= 5 && L.every(l => l.ok)) b.push('flawless');
  if (S.kind === 'daily' && !S.dailyReplay) { const d = store.get('daily', { n: 0 }); if (d.n >= 3) b.push('daily3'); if (d.n >= 7) b.push('daily7'); }
  return b;
}
async function endGame() {
  stopTimer(); musicStop(); $('#modal').hidden = true; S.card = null;
  const ms = Date.now() - S.start, correct = S.log.filter(l => l.ok).length, total = S.log.length;
  sfx.end();
  if (S.kind === 'daily' && !S.dailyReplay && total) {
    const d = store.get('daily', { last: '', n: 0 });
    if (d.last !== S.day) { d.n = d.last === dayBefore(S.day) ? d.n + 1 : 1; d.last = S.day; store.set('daily', d); }
  }
  const earnedB = total ? computeBadges() : [], have = new Set(store.get('badges', [])), fresh = earnedB.filter(b => !have.has(b));
  earnedB.forEach(b => have.add(b)); store.set('badges', [...have]);
  $('#res-badges').innerHTML = earnedB.map(id => `<div class="bdg ${fresh.includes(id) ? 'new' : ''}"><span>${BADGES[id][0]}</span><b>${BADGES[id][1]}</b><small>${fresh.includes(id) ? 'NEW! ' : ''}${BADGES[id][2]}</small></div>`).join('');
  if (fresh.length || (total && correct / total >= 0.7)) setTimeout(() => confetti(200), 300);
  S.lastMisses = S.log.filter(l => !l.ok).map(l => l.q.id);
  $('#btn-practice').hidden = !S.lastMisses.length;
  $('#btn-practice').textContent = `🔁 Practice my misses (${S.lastMisses.length})`;
  S.res = { score: S.score, correct, total, ms, badges: earnedB, title: titleFor(S.score, S.kind), kind: S.kind };
  $('#btn-share').hidden = !total;
  $('#res-kind').textContent = KIND_NAME[S.kind] + ' · ' + (S.mode === 'comp' ? '🌐 Competition' + (S.cls ? ' · 🏫 ' + S.cls : '') : '📱 Individual Challenge');
  $('#res-title').textContent = (correct / Math.max(total, 1) >= 0.7 ? 'Outstanding, ' : 'Nice effort, ') + S.name + '!';
  $('#res-score').textContent = money(S.score);
  $('#res-badge').textContent = '🎖️ ' + titleFor(S.score, S.kind);
  $('#res-stats').innerHTML = `<div><b>${correct}/${total}</b>correct</div><div><b>${total ? Math.round(correct / total * 100) : 0}%</b>accuracy</div><div><b>${fmtTime(ms)}</b>time</div><div><b>${S.log.filter(l => l.ok && l.tries === 1).length}</b>first-try</div>`;
  const by = {}; S.log.forEach(l => { const t = l.q.topic; by[t] = by[t] || { ok: 0, n: 0 }; by[t].n++; if (l.ok) by[t].ok++; });
  $('#res-topics').innerHTML = TOPICS.filter(t => by[t.id]).map(t => `<div>${t.icon} ${t.name}<br>${by[t.id].ok}/${by[t.id].n}<div class="bar"><i style="width:${by[t.id].ok / by[t.id].n * 100}%"></i></div></div>`).join('');
  const sorted = S.log.slice().sort((a, b) => a.ok - b.ok);
  $('#res-missed').innerHTML = sorted.length ? sorted.map(l => `<div class="m ${l.ok ? 'ok' : ''}"><small>${l.ok ? '✅ ' : '❌ '}${signed(l.earned)} · ${topicIcon(l.q.topic)} ${l.final ? '💰 Final Wager ' + money(l.wager) : money(l.tier)} · ${TYPE_NAME[l.q.type]}</small><p>${esc(l.q.q)}</p><p class="a">${answerHTML(l.q)}</p></div>`).join('') : '<p>No cards answered.</p>';
  show('scr-results');
  const entry = { name: S.name, avatar: S.avatar, mode: S.kind, score: S.score, correct, total: Math.max(total, 1), ms, badges: earnedB, cls: S.mode === 'comp' ? S.cls : '', day: S.kind === 'daily' ? S.day : '' };
  const rk = $('#res-rank');
  if (!total) { rk.textContent = 'No cards answered — score not recorded.'; return; }
  livePing(true);
  if (S.dailyReplay) { rk.textContent = '📅 Practice replay — come back tomorrow for a new Daily Challenge!'; return; }
  if (S.mode === 'solo') {
    const r = saveLocal(S.kind, entry);
    rk.textContent = `📱 This-device rank: #${r.rank} of ${r.players} · Your best: ${money(r.best)}`;
  } else {
    rk.textContent = '🌐 Submitting to the online leaderboard…';
    try { const r = await postGlobal(entry); rk.textContent = `🌐 Online rank: #${r.rank} of ${r.players} players · Your best: ${money(r.best)}` + (r.classRank ? ` · 🏫 ${S.cls}: #${r.classRank.rank} of ${r.classRank.players}` : ''); }
    catch (e) { rk.textContent = '⚠️ Could not submit online (' + e.message + '). Saved on this device instead.'; saveLocal(S.kind, entry); }
  }
}

/* ---------- share card ---------- */
async function shareCard() {
  const r = S.res; if (!r) return;
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1080;
  const g = cv.getContext('2d');
  try { await Promise.all([document.fonts.load('60px Sig'), document.fonts.load('700 60px Fredoka'), document.fonts.load('800 40px Nunito')]); } catch {}
  const grd = g.createLinearGradient(0, 0, 1080, 1080); grd.addColorStop(0, '#173f38'); grd.addColorStop(1, '#2f7a6b');
  g.fillStyle = grd; g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = '#fffdf5'; g.beginPath(); g.roundRect ? g.roundRect(70, 70, 940, 900, 44) : g.rect(70, 70, 940, 900); g.fill();
  g.fillStyle = '#f5b82e'; g.fillRect(70, 150, 940, 8);
  const T = (txt, y, font, col) => { g.font = font; g.fillStyle = col; g.fillText(txt, 540, y); };
  g.textAlign = 'center';
  T('🧠 Brain Bank', 135, '700 66px Fredoka, sans-serif', '#1f5c51');
  T('The Science Showdown · ' + KIND_NAME[r.kind], 225, '700 36px Nunito, sans-serif', '#667');
  T(S.avatar, 380, '130px serif', '#000');
  T(S.name, 475, '700 62px Fredoka, sans-serif', '#223');
  T(money(r.score), 630, '700 150px Fredoka, sans-serif', '#d89a00');
  T(`🎖️ ${r.title} · ${r.correct}/${r.total} correct · ${Math.round(r.correct / Math.max(r.total, 1) * 100)}%`, 715, '800 38px Nunito, sans-serif', '#2f7a6b');
  if (r.badges.length) T(r.badges.map(b => BADGES[b][0]).join(' '), 815, '62px serif', '#000');
  T('Can you beat me? ' + location.host, 920, '700 30px Nunito, sans-serif', '#889');
  g.textAlign = 'right'; g.font = '600 30px Nunito, sans-serif'; g.fillStyle = '#fff'; g.fillText('Brain Bank — by', 600, 1038);
  g.textAlign = 'left'; g.font = '52px Sig, cursive'; g.fillText('Nichzz', 612, 1042);
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  const file = new File([blob], 'brain-bank-score.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Brain Bank', text: `I banked ${money(r.score)} in Brain Bank! 🧠 ${location.origin}` }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  $('#zoom img').src = url; $('#zoom').hidden = false;
  toast('📥 Score card downloaded — share it with your friends!', 3000);
}

/* ---------- bank ---------- */
let bankOrder = null;
function openBank() {
  const sel = $('#bank-topic');
  sel.innerHTML = '<option value="">All topics</option>' + TOPICS.map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('');
  S.review = null; bankOrder = null; drawBank(); show('scr-bank');
}
function drawBank() {
  const term = norm($('#bank-search').value), tp = $('#bank-topic').value, tr = $('#bank-tier').value;
  let list = (bankOrder || QUESTIONS.slice().sort((a, b) => TOPICS.findIndex(t => t.id === a.topic) - TOPICS.findIndex(t => t.id === b.topic) || a.tier - b.tier));
  list = list.filter(q => (!tp || q.topic === tp) && (!tr || q.tier === +tr) && (!term || norm(q.q + ' ' + answerText(q)).includes(term)));
  $('#bank-count').textContent = `${list.length} of ${QUESTIONS.length} questions`;
  $('#bank-list').innerHTML = list.map(q => `<div class="bq"><div class="top"><span class="chip">${topicIcon(q.topic)} ${topicName(q.topic)}</span><span class="chip type">${TYPE_NAME[q.type]}</span><span class="v">${money(q.tier)}</span></div>
    <p>${esc(q.q)}</p>${q.img ? `<img src="${q.img}" alt="" loading="lazy">` : ''}
    <div class="ans" hidden>${answerHTML(q)}${q.why && q.type !== 'explain' ? '<br><i>' + esc(q.why) + '</i>' : ''}${q.src === 'added' ? '<br><span class="src-added">Answer key prepared for this reviewer</span>' : ''}</div>
    <div class="row"><button class="btn small ghost" data-act="show">👀 Show answer</button><button class="btn small teal" data-act="try" data-id="${q.id}">✏️ Try it</button></div></div>`).join('');
  $$('#bank-list .bq').forEach(card => {
    card.querySelector('[data-act=show]').onclick = e => { const a = card.querySelector('.ans'); a.hidden = !a.hidden; e.target.textContent = a.hidden ? '👀 Show answer' : '🙈 Hide answer'; };
    card.querySelector('[data-act=try]').onclick = e => openCard({ q: QUESTIONS.find(x => x.id === e.target.dataset.id), tier: 0 }, true);
  });
}

/* ---------- wiring ---------- */
function init() {
  initWelcome();
  $('#c-submit').onclick = submit;
  $('#c-next').onclick = nextCard;
  $('#c-forfeit').onclick = forfeit;
  $('#btn-quit').onclick = quitGame;
  $('#c-home').onclick = quitGame;
  $('#coffee').onclick = () => { $('#coffee-modal').hidden = false; };
  $('#coffee-close').onclick = () => { $('#coffee-modal').hidden = true; };
  $('#coffee-modal').onclick = e => { if (e.target.id === 'coffee-modal') $('#coffee-modal').hidden = true; };
  $('#c-img').onclick = () => { $('#zoom img').src = $('#c-img').src; $('#zoom').hidden = false; };
  document.addEventListener('click', e => { if (e.target.matches('.bq img, .feedback img')) { $('#zoom img').src = e.target.src; $('#zoom').hidden = false; } });
  $('#zoom').onclick = () => $('#zoom').hidden = true;
  syncMusicBtn();
  $('#btn-music').onclick = () => { musicOn = !musicOn; store.set('music', musicOn); syncMusicBtn(); musicOn ? musicStart() : musicStop(); };
  $$('#c-life .life').forEach(b => b.onclick = () => useLife(b.dataset.life));
  $('#btn-share').onclick = shareCard;
  $('#btn-practice').onclick = () => startReview(S.lastMisses);
  document.addEventListener('visibilitychange', () => { if (document.hidden) musicStop(); else if ($('#scr-board').classList.contains('active') && !S.review) musicStart(); });
  $('#btn-mute').textContent = muted ? '🔇' : '🔊';
  $('#btn-mute').onclick = () => { muted = !muted; store.set('muted', muted); $('#btn-mute').textContent = muted ? '🔇' : '🔊'; };
  $('#btn-finish').onclick = () => {
    if (S.review) return endReview();
    const left = S.kind === 'game' ? S.board.flat().filter(c => !c.done).length : S.queue.length - S.qi;
    if (left && !confirm(`Finish now and record ${money(S.score)}? ${left} card(s) will be left unplayed.`)) return;
    endGame();
  };
  $('#btn-again').onclick = () => startGame(S.kind);
  $('#btn-home').onclick = () => { musicStop(); S.review = null; refreshWelcome(); show('scr-welcome'); lbScope = S.mode; lbMode = S.kind; $$('#lb-scope button').forEach(b => b.classList.toggle('on', b.dataset.scope === lbScope)); $$('#lb-mode button').forEach(b => b.classList.toggle('on', b.dataset.lbmode === lbMode)); loadLB(); };
  $('#bank-back').onclick = () => show('scr-welcome');
  $('#bank-search').oninput = drawBank; $('#bank-topic').onchange = drawBank; $('#bank-tier').onchange = drawBank;
  $('#bank-shuffle').onclick = () => { bankOrder = shuffle(QUESTIONS); drawBank(); };
  document.addEventListener('keydown', e => {
    if ($('#modal').hidden) return;
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); S.card && S.card.over ? nextCard() : submit(); }
    if (e.key === 'Enter' && e.ctrlKey && e.target.tagName === 'TEXTAREA') { e.preventDefault(); submit(); }
  });
  window.addEventListener('beforeunload', e => { if ($('#scr-board').classList.contains('active') && S.log.length) { e.preventDefault(); e.returnValue = ''; } });
}
window.__sbq = { shortMatch, gradeExplain, norm, S, dailyQueue, manilaDay };
init();
})();
