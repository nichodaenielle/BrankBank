/* Brain Bank — teacher admin panel. Login → manage question sets/topics and questions. */
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TYPES = {
  tf: 'True / False', mc: 'Multiple choice', multi: 'Select all', short: 'Short answer',
  blanks: 'Fill in blanks', order: 'Put in order', label: 'Label diagram', explain: 'Explain',
};
/* Per-type editable fields. kind: text|textarea|lines|number|json|tfbool|csv */
const TYPE_FIELDS = {
  tf: [['q', 'Statement', 'textarea'], ['answer', 'Correct answer', 'tfbool'], ['why', 'Explanation shown after (optional)', 'textarea']],
  mc: [['q', 'Question', 'textarea'], ['choices', 'Choices (one per line)', 'lines'], ['answer', 'Correct choice # (1-based)', 'number'], ['why', 'Why / explanation (optional)', 'textarea']],
  multi: [['q', 'Question', 'textarea'], ['choices', 'Choices (one per line)', 'lines'], ['answers', 'Correct choice #s (comma-separated, 1-based)', 'csv'], ['why', 'Why / explanation (optional)', 'textarea']],
  short: [['q', 'Question (use ________ for the blank)', 'textarea'], ['a', 'Correct answer', 'text'], ['acc', 'Accepted alternates (comma-separated)', 'csv'], ['why', 'Why / explanation (optional)', 'textarea']],
  blanks: [['q', 'Instruction', 'textarea']],
  order: [['q', 'Instruction', 'textarea'], ['steps', 'Steps in correct order (one per line)', 'lines'], ['why', 'Why / explanation (optional)', 'textarea']],
  label: [['q', 'Instruction', 'text']],
  explain: [['q', 'Question / scenario', 'textarea'], ['model', 'Model answer', 'textarea'], ['rubric', 'Rubric JSON [{min, points:[{t, k:[...]}]}]', 'json'], ['why', 'Why / explanation (optional)', 'textarea']],
};
const COMMON_FIELDS = [
  ['img', 'Image path (optional, e.g. img/foo.webp)', 'text'],
  ['revealImg', 'Reveal image path (order type, optional)', 'text'],
];

let TOKEN = localStorage.getItem('bb_admin_token') || null;
let SETS = {};
let QUESTIONS = [];
let editing = null;
let editingNew = false;
let setEditing = null;
let topicTouched = {};
let setIdTouched = false;

function api(path, opts = {}) {
  const headers = { authorization: 'Bearer ' + TOKEN, ...(opts.headers || {}) };
  if (opts.body && typeof opts.body !== 'string') { opts.body = JSON.stringify(opts.body); headers['Content-Type'] = 'application/json'; }
  return fetch('/api/admin' + path, { ...opts, headers }).then(r => r.json().then(j => ({ ok: r.ok, status: r.status, ...j })));
}

/* ---------- auth ---------- */
async function login() {
  const pass = $('adm-pass').value;
  $('login-err').textContent = '';
  const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pass }) });
  const j = await r.json();
  if (!r.ok) { $('login-err').textContent = j.error || 'Login failed'; return; }
  TOKEN = j.token;
  localStorage.setItem('bb_admin_token', TOKEN);
  boot();
}
function logout() { TOKEN = null; localStorage.removeItem('bb_admin_token'); location.reload(); }

/* ---------- boot / data ---------- */
async function boot() {
  $('login-view').hidden = true;
  $('app-view').hidden = false;
  const [content, qs] = await Promise.all([
    fetch('/api/content').then(r => r.json()),
    api('/questions?limit=2000'),
  ]);
  if (qs.error === 'unauthorized' || qs.status === 401) { logout(); return; }
  SETS = content.sets || {};
  QUESTIONS = qs.questions || [];
  fillFilters();
  renderQuestions();
  renderSets();
  updateStats();
}

function updateStats() {
  $('stat-line').textContent = `${QUESTIONS.length} questions · ${Object.keys(SETS).length} sets`;
}

/* ---------- tabs ---------- */
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  $('tab-questions').hidden = b.dataset.tab !== 'questions';
  $('tab-sets').hidden = b.dataset.tab !== 'sets';
});

/* ---------- questions tab ---------- */
function fillFilters() {
  const fs = $('f-set'), ft = $('f-topic'), ty = $('f-type');
  const curSet = fs.value, curTopic = ft.value;
  fs.innerHTML = '<option value="">All sets</option>' + Object.keys(SETS).sort().map(id => `<option value="${esc(id)}">${esc(SETS[id].label || SETS[id].name)}</option>`).join('');
  const topics = {};
  Object.values(SETS).forEach(s => (s.topics || []).forEach(t => topics[t.id] = t));
  ft.innerHTML = '<option value="">All topics</option>' + Object.keys(topics).sort().map(id => `<option value="${esc(id)}">${esc(topics[id].icon || '')} ${esc(topics[id].name)}</option>`).join('');
  ty.innerHTML = '<option value="">All types</option>' + Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  fs.value = curSet; ft.value = curTopic;
}

function filteredQuestions() {
  const q = $('f-q').value.toLowerCase(), set = $('f-set').value, topic = $('f-topic').value,
        tier = $('f-tier').value, type = $('f-type').value;
  return QUESTIONS.filter(x =>
    (!q || x.q.toLowerCase().includes(q) || String(x.a || x.answer || '').toLowerCase().includes(q)) &&
    (!set || x.set === set) && (!topic || x.topic === topic) &&
    (!tier || String(x.tier) === tier) && (!type || x.type === type));
}

function renderQuestions() {
  const list = filteredQuestions();
  $('q-list').innerHTML = list.length ? list.map(q => `
    <div class="q-row">
      <div class="q-main">
        <div class="q-top">
          <span class="chip t${q.tier}">$${q.tier}</span>
          <span class="chip type">${TYPES[q.type] || q.type}</span>
          <span class="chip plain">${esc((SETS[q.set] && (SETS[q.set].label || SETS[q.set].name)) || q.set)}</span>
          <span class="chip plain">${esc(q.topic)}</span>
        </div>
        <p>${esc(q.q)}</p>
        <span class="q-id">${esc(q.id)} · ${esc(q.src || 'deck')}</span>
      </div>
      <button class="btn small ghost ed" data-id="${esc(q.id)}">✏️</button>
      <button class="btn small ghost del" data-id="${esc(q.id)}" style="color:var(--red)">🗑</button>
    </div>`).join('') :
    `<p class="count-note" style="padding:16px">No questions match. Click "＋ New question" or import via <code>tools/seed-content.js</code>.</p>`;
  document.querySelectorAll('.q-row .ed').forEach(b => b.onclick = () => openEditor(QUESTIONS.find(x => x.id === b.dataset.id)));
  document.querySelectorAll('.q-row .del').forEach(b => b.onclick = async () => {
    const target = QUESTIONS.find(x => x.id === b.dataset.id) || {};
    if (!(await confirmDialog(`Delete question "${target.q || b.dataset.id}"?`))) return;
    const r = await api('/questions/' + encodeURIComponent(b.dataset.id), { method: 'DELETE' });
    if (!r.ok) alert(r.error || 'Delete failed'); else { QUESTIONS = QUESTIONS.filter(x => x.id !== b.dataset.id); renderQuestions(); updateStats(); }
  });
}

/* ---------- question editor ---------- */
function openEditor(q) {
  editingNew = !q;
  editing = q ? JSON.parse(JSON.stringify(q)) : {
    id: newId(), set: $('f-set').value || Object.keys(SETS)[0], topic: '', tier: 100, type: 'mc',
    q: '', choices: ['', ''], answer: 0, src: 'added',
  };
  renderEditor();
  $('ed-modal').hidden = false;
}

/* display value for a field (arrays -> text) */
function dispVal(key, v, type) {
  if (v === undefined || v === null) return '';
  if (key === 'answer' && (type === 'tf')) return v ? 'True' : 'False';
  if (key === 'answer' && (type === 'mc')) return Number(v) + 1;
  if (key === 'answers' && type === 'multi') return (v || []).map(i => i + 1).join(', ');
  if (key === 'acc' && Array.isArray(v)) return v.join(', ');
  if (Array.isArray(v)) return v.join('\n');
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function fieldHtml(key, label, kind, val, type) {
  const dv = dispVal(key, val, type);
  if (kind === 'textarea') return `<div class="full"><label>${label}</label><textarea data-f="${key}">${esc(dv)}</textarea></div>`;
  if (kind === 'lines') return `<div class="full"><label>${label}</label><textarea data-f="${key}">${esc(dv)}</textarea></div>`;
  if (kind === 'json') return `<div class="full"><label>${label}</label><textarea data-f="${key}" style="font-family:monospace;font-size:.82rem">${esc(dv)}</textarea></div>`;
  if (kind === 'tfbool') return `<div><label>${label}</label><select data-f="${key}"><option value="true" ${val === true || val === 'true' ? 'selected' : ''}>True</option><option value="false" ${val === false || val === 'false' ? 'selected' : ''}>False</option></select></div>`;
  if (kind === 'number') return `<div><label>${label}</label><input data-f="${key}" type="number" min="1" value="${dv}"></div>`;
  return `<div class="full"><label>${label}</label><input data-f="${key}" value="${esc(dv)}"></div>`;
}

function renderEditor() {
  const q = editing;
  $('ed-title').textContent = editingNew ? 'New question' : 'Edit ' + q.id;
  $('ed-kind').textContent = TYPES[q.type] || q.type;
  $('ed-err').textContent = '';

  const head = `
    <div><label>ID <span class="hint-note">(auto-generated — you can ignore this)</span></label><input id="e-id" value="${esc(q.id || '')}" ${editingNew ? '' : 'disabled style="background:#eee"'}></div>
    <div><label>Set</label><select id="e-set">${Object.entries(SETS).map(([id, s]) => `<option value="${esc(id)}" ${id === q.set ? 'selected' : ''}>${esc(s.label || s.name)}</option>`).join('')}</select></div>
    <div><label>Topic</label><select id="e-topic"></select></div>
    <div><label>Value</label><select id="e-tier">${[100, 200, 300, 400, 500].map(t => `<option value="${t}" ${t === q.tier ? 'selected' : ''}>$${t}</option>`).join('')}</select></div>
    <div><label>Type</label><select id="e-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === q.type ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div><label>Source</label><select id="e-src">${['added', 'deck', 'external'].map(s => `<option ${s === (q.src || 'added') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>`;

  const body = TYPE_FIELDS[q.type].map(([key, label, kind]) => fieldHtml(key, label, kind, getQ(q, key), q.type)).join('');
  const common = (q.type === 'order' ? COMMON_FIELDS : COMMON_FIELDS.filter(f => f[0] === 'img'))
    .map(([key, label, kind]) => fieldHtml(key, label, kind, getQ(q, key), q.type)).join('');

  $('ed-form').innerHTML = head + body + common + '<div class="ed-type" id="ed-extra"></div>';

  const topicSel = $('e-topic');
  const fillTopics = () => {
    const set = SETS[$('e-set').value];
    topicSel.innerHTML = (set ? set.topics : []).map(t => `<option value="${esc(t.id)}" ${t.id === q.topic ? 'selected' : ''}>${esc(t.icon || '')} ${esc(t.name)}</option>`).join('');
  };
  fillTopics();
  topicSel.onchange = () => { q.topic = topicSel.value; };
  $('e-set').onchange = () => {
    q.set = $('e-set').value;
    const topics = (SETS[q.set] && SETS[q.set].topics) || [];
    if (!topics.some(t => t.id === q.topic)) q.topic = topics[0] ? topics[0].id : '';
    fillTopics();
  };
  $('e-tier').onchange = () => { q.tier = +$('e-tier').value; };
  $('e-src').onchange = () => { q.src = $('e-src').value; };
  $('e-type').onchange = () => {
    q.type = $('e-type').value;
    if (q.type === 'tf' && typeof q.answer !== 'boolean') q.answer = true;
    if ((q.type === 'mc' || q.type === 'multi') && !Array.isArray(q.choices)) q.choices = ['', ''];
    if (q.type === 'blanks' && !Array.isArray(q.fields)) q.fields = [];
    if (q.type === 'label' && !Array.isArray(q.labels)) q.labels = [];
    if (q.type === 'order' && !Array.isArray(q.steps)) q.steps = [];
    renderEditor();
  };
  $('e-id').oninput = e => { q.id = e.target.value.trim(); };

  // bind typed fields
  $('ed-form').querySelectorAll('[data-f]').forEach(el => {
    el.oninput = () => {
      const key = el.dataset.f;
      if (key === 'choices' || key === 'steps') {
        setQ(q, key, el.value.split('\n').map(s => s.trim()).filter(Boolean));
      } else if (key === 'acc') {
        setQ(q, key, el.value.split(',').map(s => s.trim()).filter(Boolean));
      } else if (key === 'answers' && q.type === 'multi') {
        setQ(q, key, el.value.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(n => !isNaN(n)));
      } else if (key === 'answer') {
        setQ(q, key, q.type === 'tf' ? el.value === 'true' : q.type === 'mc' ? parseInt(el.value, 10) - 1 : el.value);
      } else if (key === 'rubric') {
        setQ(q, key, el.value); // parsed at save
      } else {
        setQ(q, key, el.value);
      }
    };
  });

  renderExtra();
}

function getQ(o, path) { return path.split('.').reduce((x, k) => (x == null ? x : x[k]), o); }
function setQ(o, path, v) {
  const parts = path.split('.');
  let x = o;
  for (let i = 0; i < parts.length - 1; i++) { if (x[parts[i]] === undefined) x[parts[i]] = {}; x = x[parts[i]]; }
  x[parts[parts.length - 1]] = v;
}

/* structured editors for blanks fields and label labels */
function renderExtra() {
  const q = editing, box = $('ed-extra');
  if (q.type === 'blanks') {
    q.fields = q.fields || [];
    box.innerHTML = `<h4>Blanks (${q.fields.length})</h4><div class="kv-list" id="bf-list"></div>
      <button class="btn small ghost add-opt" id="bf-add">＋ Add blank</button>
      <p class="hint-note">Each blank: label text, kind (text/select/num), answer. For select/num add options or value+tolerance.</p>`;
    const list = $('bf-list');
    const draw = () => {
      list.innerHTML = q.fields.map((f, i) => `
        <div class="kv-row" style="grid-template-columns:2fr 90px 1fr 30px">
          <input type="text" data-bf="label" data-i="${i}" value="${esc(f.label || '')}" placeholder="Sentence with ___">
          <select data-bf="kind" data-i="${i}">${['text', 'select', 'num'].map(k => `<option ${f.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
          <input type="text" data-bf="answer" data-i="${i}" value="${esc(f.answer ?? f.a ?? f.value ?? '')}" placeholder="answer${f.kind === 'select' ? ' (must match an option)' : ''}">
          <button class="rm" data-br="${i}">×</button>
        </div>
        ${f.kind === 'select' ? `<div class="kv-row" style="grid-template-columns:1fr"><input type="text" data-bf="options" data-i="${i}" value="${esc((f.options || []).join(', '))}" placeholder="options, comma-separated"></div>` : ''}
        ${f.kind === 'text' ? `<div class="kv-row" style="grid-template-columns:1fr"><input type="text" data-bf="acc" data-i="${i}" value="${esc((f.acc || []).join(', '))}" placeholder="accepted alternates, comma-separated"></div>` : ''}`).join('');
      list.querySelectorAll('input,select').forEach(el => el.oninput = () => {
        const i = +el.dataset.i, k = el.dataset.bf, f = q.fields[i];
        if (k === 'options') f.options = el.value.split(',').map(s => s.trim()).filter(Boolean);
        else if (k === 'acc') f.acc = el.value.split(',').map(s => s.trim()).filter(Boolean);
        else if (k === 'kind') { f.kind = el.value; if (el.value === 'select') { f.options = f.options || [f.answer || '']; f.answer = f.answer || f.options[0]; } else { f.a = f.a || f.answer; delete f.answer; } draw(); }
        else if (k === 'answer') { if (f.kind === 'num') { f.value = parseFloat(el.value); } else if (f.kind === 'select') f.answer = el.value; else { f.a = el.value; } }
        else f[k] = el.value;
      });
      list.querySelectorAll('[data-br]').forEach(b => b.onclick = () => { q.fields.splice(+b.dataset.br, 1); draw(); });
    };
    draw();
    $('bf-add').onclick = () => { q.fields.push({ label: '', kind: 'text', a: '' }); draw(); };
  } else if (q.type === 'label') {
    q.labels = q.labels || [];
    box.innerHTML = `<h4>Labels (${q.labels.length}) — letter + name pairs</h4><div class="kv-list" id="lb-list"></div>
      <button class="btn small ghost add-opt" id="lb-add">＋ Add label</button>`;
    const list = $('lb-list');
    const draw = () => {
      list.innerHTML = q.labels.map((l, i) => `
        <div class="kv-row" style="grid-template-columns:70px 1fr 30px">
          <input type="text" data-lb="0" data-i="${i}" value="${esc(l[0] || '')}" placeholder="A">
          <input type="text" data-lb="1" data-i="${i}" value="${esc(l[1] || '')}" placeholder="Part name">
          <button class="rm" data-lbr="${i}">×</button>
        </div>`).join('');
      list.querySelectorAll('input').forEach(el => el.oninput = () => { q.labels[+el.dataset.i][+el.dataset.lb] = el.value; });
      list.querySelectorAll('[data-lbr]').forEach(b => b.onclick = () => { q.labels.splice(+b.dataset.lbr, 1); draw(); });
    };
    draw();
    $('lb-add').onclick = () => { q.labels.push(['', '']); draw(); };
  } else {
    box.innerHTML = '';
  }
}

function newId() {
  return 'q-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

$('btn-new').onclick = () => openEditor(null);
$('ed-cancel').onclick = () => $('ed-modal').hidden = true;
$('ed-save').onclick = async () => {
  $('ed-err').textContent = '';
  const q = JSON.parse(JSON.stringify(editing));
  if (editingNew && !q.id) q.id = newId();
  if (!q.q || !String(q.q).trim()) { $('ed-err').textContent = 'Question text is required'; return; }
  if (!q.set || !q.topic) { $('ed-err').textContent = 'Set and topic are required'; return; }
  // type-specific normalization
  if (q.type === 'mc' || q.type === 'multi') {
    q.choices = (q.choices || []).map(s => String(s).trim()).filter(Boolean);
    if (q.choices.length < 2) { $('ed-err').textContent = 'Needs at least 2 choices'; return; }
    if (q.type === 'mc') { if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) { $('ed-err').textContent = 'Pick a valid correct choice'; return; } }
    else if (!Array.isArray(q.answers) || !q.answers.length || q.answers.some(i => !Number.isInteger(i) || i < 0 || i >= q.choices.length)) { $('ed-err').textContent = 'Pick at least one valid correct choice'; return; }
  }
  if (q.type === 'short' && !String(q.a || '').trim()) { $('ed-err').textContent = 'Correct answer (a) is required'; return; }
  if (q.type === 'tf' && typeof q.answer !== 'boolean') { $('ed-err').textContent = 'Pick True or False'; return; }
  if (q.type === 'explain') {
    if (!String(q.model || '').trim()) { $('ed-err').textContent = 'Model answer is required'; return; }
    if (typeof q.rubric === 'string' && q.rubric.trim()) { try { q.rubric = JSON.parse(q.rubric); } catch { $('ed-err').textContent = 'Rubric must be valid JSON'; return; } }
    if (!Array.isArray(q.rubric) || !q.rubric.length) { $('ed-err').textContent = 'Explain needs a non-empty rubric JSON array'; return; }
  }
  if (q.type === 'order' && (!Array.isArray(q.steps) || q.steps.length < 2)) { $('ed-err').textContent = 'Order needs at least 2 steps'; return; }
  if (q.type === 'blanks' && (!Array.isArray(q.fields) || !q.fields.length)) { $('ed-err').textContent = 'Add at least one blank'; return; }
  if (q.type === 'label' && (!Array.isArray(q.labels) || !q.labels.length)) { $('ed-err').textContent = 'Add at least one label'; return; }
  // cleanup empties
  ['img', 'revealImg', 'why', 'acc'].forEach(k => { if (q[k] === '' || (Array.isArray(q[k]) && !q[k].length)) delete q[k]; });
  q.tier = +q.tier;

  const wasEdit = !editingNew;
  const r = await api('/questions' + (wasEdit ? '/' + encodeURIComponent(editing.id) : ''), { method: wasEdit ? 'PUT' : 'POST', body: { question: q } });
  if (!r.ok) { $('ed-err').textContent = r.error || 'Save failed'; return; }
  if (wasEdit) {
    const i = QUESTIONS.findIndex(x => x.id === editing.id);
    if (i >= 0) QUESTIONS[i] = r.question; else QUESTIONS.push(r.question);
  } else QUESTIONS.push(r.question);
  $('ed-modal').hidden = true;
  fillFilters(); renderQuestions(); renderSets(); updateStats();
};
['f-q', 'f-set', 'f-topic', 'f-tier', 'f-type'].forEach(id => $(id).addEventListener('input', renderQuestions));

/* ---------- sets tab ---------- */
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 30);
}
function topicCounts() {
  const m = {};
  QUESTIONS.forEach(q => { const k = q.set + '|' + q.topic; m[k] = (m[k] || 0) + 1; });
  return m;
}
function renderSets() {
  const counts = topicCounts();
  const grid = $('set-grid');
  const cards = Object.entries(SETS).sort().map(([id, s]) => {
    const n = QUESTIONS.filter(q => q.set === id).length;
    const topics = (s.topics || []).map(t =>
      `<span>${esc(t.icon || '')} ${esc(t.name)} <small>(${counts[id + '|' + t.id] || 0})</small></span>`).join('');
    return `<div class="set-card">
      <div class="sc-head"><span class="sc-icon">${esc(s.icon || '📚')}</span>
        <div class="sc-name">${esc(s.label || s.name)}</div></div>
      <div class="sc-meta">${esc(s.name)} · Grade ${s.grade} · Sem ${s.semester} · <b>${esc(id)}</b></div>
      <div class="sc-topics">${topics}</div>
      <div class="sc-count">${n} question${n === 1 ? '' : 's'}</div>
      <div class="sc-acts">
        <button class="btn small ghost se" data-id="${esc(id)}">✏️ Edit set</button>
      </div>
    </div>`;
  }).join('');
  grid.innerHTML = cards + `<div class="set-new" id="set-new">＋ New question set</div>`;
  document.querySelectorAll('.se').forEach(b => b.onclick = () => openSetEditor(SETS[b.dataset.id], b.dataset.id));
  $('set-new').onclick = () => openSetEditor(null);
}

function openSetEditor(s, id) {
  setEditing = s ? JSON.parse(JSON.stringify(s)) : { id: '', name: '', grade: 7, semester: 1, icon: '📚', subject: '', label: '', topics: [{ id: '', name: '', icon: '' }] };
  topicTouched = {};
  setIdTouched = !!s;
  $('s-delete').hidden = !s;
  $('s-delete').dataset.id = id || '';
  $('set-title').textContent = s ? 'Edit ' + (s.label || s.name) : 'New question set';
  $('set-err').textContent = '';
  $('set-err').style.display = 'none';
  $('s-id').value = s ? id : '';
  $('s-id').disabled = !!s;
  $('s-icon').value = s ? (s.icon || '') : '';
  $('s-name').value = s ? (s.name || '') : '';
  $('s-grade').value = s ? s.grade : '';
  $('s-semester').value = s ? s.semester : '';
  $('s-label').value = s ? (s.label || '') : '';
  syncLabel();
  renderSetTopics();
  $('set-modal').hidden = false;
}

function syncLabel() {
  const name = $('s-name').value.trim(), grade = $('s-grade').value, sem = $('s-semester').value;
  if (!$('s-label').value || !$('s-label').dataset.touched) {
    $('s-label').value = name && grade ? `${$('s-icon').value || '📚'} ${name} · Grade ${grade} · Sem ${sem || 1}` : '';
  }
}

function renderSetTopics() {
  const counts = topicCounts();
  const sid = $('s-id').value || setEditing.id || '';
  $('s-topics').innerHTML = (setEditing.topics || []).map((t, i) => `
    <div class="topic-row" data-i="${i}">
      <input class="ic" data-k="icon" value="${esc(t.icon || '')}" maxlength="4" placeholder="🔢">
      <input class="name" data-k="name" value="${esc(t.name || '')}" placeholder="Topic name">
      <input class="tid" data-k="id" value="${esc(t.id || '')}" placeholder="topic-id">
      <button class="rm" data-t="${i}">×</button>
      <span class="tq">${counts[sid + '|' + t.id] || 0} questions</span>
    </div>`).join('');
  $('s-topics-hint').textContent = `(${(setEditing.topics || []).length})`;
  document.querySelectorAll('#s-topics .topic-row').forEach(row => {
    const i = +row.dataset.i;
    row.querySelectorAll('input').forEach(inp => inp.oninput = () => {
      const k = inp.dataset.k;
      setEditing.topics[i][k] = inp.value;
      if (k === 'name' && !topicTouched[i]) {
        const slug = slugify(inp.value);
        setEditing.topics[i].id = slug;
        row.querySelector('.tid').value = slug;
      }
      if (k === 'id') topicTouched[i] = true;
    });
    row.querySelector('.rm').onclick = () => { setEditing.topics.splice(i, 1); renderSetTopics(); };
  });
}
$('s-addt').onclick = () => { setEditing.topics.push({ id: '', name: '', icon: '' }); renderSetTopics(); };

$('s-id').addEventListener('input', () => { setIdTouched = true; setEditing.id = $('s-id').value.trim().toLowerCase(); renderSetTopics(); });
$('s-icon').addEventListener('input', syncLabel);
$('s-name').addEventListener('input', () => {
  if (!setIdTouched) {
    const slug = slugify($('s-name').value);
    if (slug) { $('s-id').value = slug; setEditing.id = slug; renderSetTopics(); }
  }
  syncLabel();
});
$('s-grade').addEventListener('input', syncLabel);
$('s-semester').addEventListener('input', syncLabel);
$('s-label').addEventListener('input', () => { $('s-label').dataset.touched = '1'; setEditing.label = $('s-label').value; });

$('s-cancel').onclick = () => $('set-modal').hidden = true;
$('s-save').onclick = async () => {
  $('set-err').textContent = '';
  $('set-err').style.display = 'none';
  const set = {
    id: $('s-id').value.trim().toLowerCase(),
    name: $('s-name').value.trim(),
    grade: +$('s-grade').value, semester: +$('s-semester').value,
    icon: $('s-icon').value.trim() || '📚', subject: slugify($('s-name').value) || 'general',
    label: $('s-label').value.trim(),
    topics: (setEditing.topics || []).filter(t => t.name && t.id).map(t => ({ id: slugify(t.id) || slugify(t.name), name: t.name.trim(), icon: (t.icon || '').trim() })),
  };
  if (!set.id || !set.name || !set.grade || !set.topics.length) { $('set-err').textContent = 'ID, name, grade and at least one topic are required'; $('set-err').style.display = 'block'; return; }
  // warn if topics were renamed/removed while questions reference them
  const old = SETS[set.id];
  if (old) {
    const oldIds = new Set(old.topics.map(t => t.id));
    const removed = [...oldIds].filter(t => !set.topics.some(x => x.id === t));
    if (removed.length) {
      const n = QUESTIONS.filter(q => q.set === set.id && removed.includes(q.topic)).length;
      if (n && !(await confirmDialog(`Removing topic(s) ${removed.join(', ')} orphans ${n} question(s). Save anyway?`, 'Save anyway'))) return;
    }
  }
  const existing = !!SETS[set.id];
  const r = await api('/sets' + (existing ? '/' + encodeURIComponent(set.id) : ''), { method: existing ? 'PUT' : 'POST', body: { set } });
  if (!r.ok) { $('set-err').textContent = r.error || 'Save failed'; $('set-err').style.display = 'block'; return; }
  SETS[set.id] = r.set;
  $('set-modal').hidden = true;
  fillFilters(); renderSets(); renderQuestions(); updateStats();
};
$('s-delete').onclick = async () => {
  const id = $('s-delete').dataset.id;
  $('set-err').style.display = 'none';
  if (!id || !(await confirmDialog(`Delete set "${SETS[id] ? (SETS[id].label || SETS[id].name) : id}"? This cannot be undone.`))) return;
  const r = await api('/sets/' + encodeURIComponent(id), { method: 'DELETE' });
  if (!r.ok) { $('set-err').textContent = r.error || 'Delete failed'; $('set-err').style.display = 'block'; return; }
  delete SETS[id];
  $('set-modal').hidden = true;
  fillFilters(); renderSets(); renderQuestions(); updateStats();
};

/* ---------- confirm dialog (theme-consistent) ---------- */
function confirmDialog(msg, yesLabel = 'Delete') {
  $('cf-msg').textContent = msg;
  $('cf-yes').textContent = yesLabel;
  $('cf-modal').hidden = false;
  return new Promise(res => {
    $('cf-no').onclick = () => { $('cf-modal').hidden = true; res(false); };
    $('cf-yes').onclick = () => { $('cf-modal').hidden = true; res(true); };
  });
}

/* ---------- init ---------- */
$('btn-login').onclick = login;
$('adm-pass').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
$('btn-logout').onclick = logout;
if (TOKEN) boot(); else $('login-view').hidden = false;
