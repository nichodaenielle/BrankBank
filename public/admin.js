/* Brain Bank admin — question CRUD. Talks to /api/admin/* with a bearer token. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPES = ['tf', 'mc', 'short', 'multi', 'label', 'blanks', 'order', 'explain'];
const TYPE_NAME = { tf: 'True / False', mc: 'Multiple choice', short: 'Identification', multi: 'Select all', label: 'Diagram labeling', blanks: 'Fill in / Solve', order: 'Sequence', explain: 'Explain' };

let token = sessionStorage.getItem('sbq_admin') || '';
let SETS = {}, QUESTIONS = [], editing = null, dirtyChoices = null;

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { logout(); throw new Error('Session expired — log in again.'); }
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
const getJSON = url => fetch(url, { cache: 'no-store' }).then(r => r.json());

/* ---------- login ---------- */
async function login() {
  const pass = $('#adm-pass').value;
  $('#login-err').textContent = '';
  try {
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pass }) });
    const j = await r.json();
    if (!r.ok) { $('#login-err').textContent = j.error || 'Login failed'; return; }
    token = j.token; sessionStorage.setItem('sbq_admin', token);
    showDash();
  } catch { $('#login-err').textContent = 'Cannot reach server.'; }
}
function logout() { token = ''; sessionStorage.removeItem('sbq_admin'); $('#dash').hidden = true; $('#login-card').hidden = false; $('#who-box').hidden = true; }

/* ---------- data ---------- */
async function loadAll() {
  const [c, q] = await Promise.all([getJSON('/api/content'), api('/api/admin/questions')]);
  SETS = c.sets || {}; QUESTIONS = q.questions || [];
  fillFilters(); renderList();
}
function topicsOf(setId) { return (SETS[setId] && SETS[setId].topics) || []; }
function fillFilters() {
  const keep = id => $(id).value;
  $('#f-set').innerHTML = '<option value="">All sets</option>' + Object.values(SETS).map(s => `<option value="${s.id}">${esc(s.label || s.name)}</option>`).join('');
  $('#f-set').value = keep('#f-set');
  $('#f-type').innerHTML = '<option value="">All types</option>' + TYPES.map(t => `<option value="${t}">${TYPE_NAME[t]}</option>`).join('');
  $('#f-type').value = keep('#f-type');
  drawTopics();
}
function drawTopics() {
  const setId = $('#f-set').value, cur = $('#f-topic').value;
  const topics = setId ? topicsOf(setId) : Object.values(SETS).flatMap(s => s.topics || []);
  $('#f-topic').innerHTML = '<option value="">All topics</option>' + topics.map(t => `<option value="${t.id}">${t.icon || ''} ${esc(t.name)}</option>`).join('');
  $('#f-topic').value = cur;
}
function filtered() {
  const term = $('#f-q').value.trim().toLowerCase(), tp = $('#f-topic').value, tr = $('#f-tier').value, ty = $('#f-type').value, se = $('#f-set').value;
  return QUESTIONS.filter(q =>
    (!se || q.set === se) && (!tp || q.topic === tp) && (!tr || q.tier === +tr) && (!ty || q.type === ty) &&
    (!term || (q.q + ' ' + (q.a || '') + ' ' + JSON.stringify(q.choices || '')).toLowerCase().includes(term)));
}
function renderList() {
  const list = filtered().slice(0, 300);
  $('#q-count').textContent = `${filtered().length} of ${QUESTIONS.length} questions`;
  $('#q-list').innerHTML = list.map(q => `<div class="q-row" data-id="${esc(q.id)}">
    <div class="q-main">
      <div class="q-top">
        <span class="chip t${q.tier}">$${q.tier}</span>
        <span class="chip type">${TYPE_NAME[q.type] || q.type}</span>
        <span class="chip">${esc((SETS[q.set] && SETS[q.set].topics.find(t => t.id === q.topic) || {}).name || q.topic)}</span>
        <span class="q-id">${esc(q.id)}${q.src ? ' · ' + esc(q.src) : ''}</span>
      </div>
      <p>${esc(q.q)}</p>
    </div>
    <button class="btn small teal" data-act="edit">✏️</button>
    <button class="btn small ghost" data-act="del">🗑️</button>
  </div>`).join('') || '<p class="count-note">No questions match.</p>';
  $$('#q-list .q-row').forEach(row => {
    const q = QUESTIONS.find(x => x.id === row.dataset.id);
    row.querySelector('[data-act=edit]').onclick = () => openEditor(q);
    row.querySelector('[data-act=del]').onclick = async () => {
      if (!confirm(`Delete "${q.id}"? This cannot be undone.`)) return;
      try { await api('/api/admin/questions/' + encodeURIComponent(q.id), { method: 'DELETE' }); await loadAll(); }
      catch (e) { alert(e.message); }
    };
  });
}

/* ---------- editor ---------- */
function field(label, inner, cls = '') { return `<div class="${cls}"><label>${label}</label>${inner}</div>`; }
function openEditor(q) {
  editing = q ? { ...q } : null;
  const sets = Object.values(SETS);
  const firstSet = editing ? editing.set : (sets[0] && sets[0].id) || '';
  const topics = topicsOf(firstSet);
  $('#ed-title').textContent = editing ? 'Edit ' + editing.id : 'New question';
  $('#ed-err').textContent = '';
  dirtyChoices = editing && Array.isArray(editing.choices) ? editing.choices.slice() : ['', ''];
  $('#ed-form').innerHTML = `
    ${field('ID', `<input id="e-id" value="${esc(editing ? editing.id : '')}" ${editing ? 'readonly' : ''} placeholder="e.g. g99">`, 'full')}
    ${field('Set', `<select id="e-set">${sets.map(s => `<option value="${s.id}" ${s.id === firstSet ? 'selected' : ''}>${esc(s.label || s.name)}</option>`).join('')}</select>`)}
    ${field('Topic', `<select id="e-topic">${topics.map(t => `<option value="${t.id}" ${editing && editing.topic === t.id ? 'selected' : ''}>${t.icon || ''} ${esc(t.name)}</option>`).join('')}</select>`)}
    ${field('Value ($)', `<select id="e-tier">${[100, 200, 300, 400, 500].map(t => `<option ${editing && editing.tier === t ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
    ${field('Type', `<select id="e-type">${TYPES.map(t => `<option value="${t}" ${editing && editing.type === t ? 'selected' : ''}>${TYPE_NAME[t]}</option>`).join('')}</select>`)}
    ${field('Question', `<textarea id="e-q" rows="3">${esc(editing ? editing.q : '')}</textarea>`, 'full')}
    <div class="full ed-type" id="e-typebox"></div>
    ${field('Image (optional)', `<input id="e-img" value="${esc(editing && editing.img || '')}" placeholder="img/photo.webp">`)}
    ${field('Source', `<select id="e-src"><option value="added" ${!editing || editing.src !== 'deck' ? 'selected' : ''}>added (teacher-written)</option><option value="deck" ${editing && editing.src === 'deck' ? 'selected' : ''}>deck</option></select>`)}
    ${field('Explanation shown after answering (why)', `<input id="e-why" value="${esc(editing && editing.why || '')}">`, 'full')}
  `;
  $('#e-set').onchange = () => {
    const tps = topicsOf($('#e-set').value);
    $('#e-topic').innerHTML = tps.map(t => `<option value="${t.id}">${t.icon || ''} ${esc(t.name)}</option>`).join('');
  };
  $('#e-type').onchange = drawTypeEditor;
  drawTypeEditor();
  $('#ed-modal').hidden = false;
}
function drawTypeEditor() {
  const type = $('#e-type').value, q = editing || {};
  const box = $('#e-typebox');
  if (type === 'tf') {
    box.innerHTML = `<h4>Answer</h4><select id="e-answer"><option value="true" ${q.answer === true ? 'selected' : ''}>True</option><option value="false" ${q.answer === false ? 'selected' : ''}>False</option></select>`;
  } else if (type === 'mc' || type === 'multi') {
    box.innerHTML = `<h4>${type === 'mc' ? 'Choices & correct answer' : 'Choices & correct answers (tick all that apply)'}</h4>
      <div class="opt-list" id="e-choices"></div>
      <button class="btn small ghost add-opt" id="e-addc">＋ Add choice</button>
      <div id="e-mcans" style="margin-top:10px"></div>`;
    const list = $('#e-choices');
    const drawC = () => {
      list.innerHTML = dirtyChoices.map((c, i) => `<div class="opt-row"><input type="text" data-i="${i}" value="${esc(c)}" placeholder="Choice ${i + 1}"><button class="rm" data-i="${i}" ${dirtyChoices.length <= 2 ? 'disabled' : ''}>✕</button></div>`).join('');
      $$('#e-choices input').forEach(inp => inp.oninput = () => dirtyChoices[+inp.dataset.i] = inp.value);
      $$('#e-choices .rm').forEach(b => b.onclick = () => { dirtyChoices.splice(+b.dataset.i, 1); drawC(); drawAns(); });
      drawAns();
    };
    const drawAns = () => {
      const el = $('#e-mcans'); if (!el) return;
      if (type === 'mc') el.innerHTML = `<label>Correct choice</label><select id="e-answer">${dirtyChoices.map((c, i) => `<option value="${i}" ${q.answer === i ? 'selected' : ''}>${i + 1}. ${esc(c || '…')}</option>`).join('')}</select>`;
      else el.innerHTML = `<label>Correct choices</label><div class="opt-list">${dirtyChoices.map((c, i) => `<label class="opt-row"><input type="checkbox" data-i="${i}" ${(q.answers || []).includes(i) ? 'checked' : ''}> ${i + 1}. ${esc(c || '…')}</label>`).join('')}</div>`;
    };
    $('#e-addc').onclick = () => { dirtyChoices.push(''); drawC(); };
    drawC();
  } else if (type === 'short') {
    box.innerHTML = `<h4>Answer</h4>
      <label>Correct answer</label><input id="e-a" value="${esc(q.a || '')}">
      <label style="margin-top:8px">Accepted alternatives (comma separated)</label><input id="e-acc" value="${esc((q.acc || []).join(', '))}">
      <label style="margin-top:8px">Rejected answers (comma separated, optional)</label><input id="e-rej" value="${esc((q.rej || []).join(', '))}">`;
  } else if (type === 'explain') {
    box.innerHTML = `<h4>Model answer & rubric</h4>
      <label>Model answer (what a perfect answer says)</label><textarea id="e-model" rows="4">${esc(q.model || '')}</textarea>
      <label style="margin-top:8px">Rubric (JSON — auto-marking rules)</label><textarea id="e-rubric" rows="6" placeholder='[{"min":2,"points":[{"t":"idea","k":["synonym1|synonym2"]}]}]'>${q.rubric ? esc(JSON.stringify(q.rubric, null, 1)) : ''}</textarea>`;
  } else if (type === 'blanks') {
    box.innerHTML = `<h4>Fields (JSON)</h4><textarea id="e-fields" rows="6" placeholder='[{"label":"An egg carries the ___ chromosome","kind":"select","options":["X","Y"],"answer":"X"}]'>${q.fields ? esc(JSON.stringify(q.fields, null, 1)) : ''}</textarea>`;
  } else if (type === 'label') {
    box.innerHTML = `<h4>Labels (JSON — pairs of [letter, answer])</h4><textarea id="e-labels" rows="5" placeholder='[["A","Uterus"],["B","Ovary"]]'>${q.labels ? esc(JSON.stringify(q.labels, null, 1)) : ''}</textarea>`;
  } else if (type === 'order') {
    box.innerHTML = `<h4>Steps (one per line, in correct order)</h4><textarea id="e-steps" rows="6">${esc((q.steps || []).join('\n'))}</textarea>`;
  }
}
function collectQuestion() {
  const type = $('#e-type').value;
  const q = {
    id: $('#e-id').value.trim(), set: $('#e-set').value, topic: $('#e-topic').value,
    tier: +$('#e-tier').value, type, q: $('#e-q').value.trim(),
    img: $('#e-img').value.trim() || undefined, why: $('#e-why').value.trim() || undefined,
    src: $('#e-src').value
  };
  if (type === 'tf') q.answer = $('#e-answer').value === 'true';
  else if (type === 'mc') { q.choices = dirtyChoices.map(s => s.trim()).filter(Boolean); q.answer = +$('#e-answer').value; }
  else if (type === 'multi') { q.choices = dirtyChoices.map(s => s.trim()).filter(Boolean); q.answers = $$('#e-mcans input[type=checkbox]:checked').map(c => +c.dataset.i); }
  else if (type === 'short') {
    q.a = $('#e-a').value.trim();
    const acc = $('#e-acc').value.split(',').map(s => s.trim()).filter(Boolean); if (acc.length) q.acc = acc;
    const rej = $('#e-rej').value.split(',').map(s => s.trim()).filter(Boolean); if (rej.length) q.rej = rej;
  }
  else if (type === 'explain') {
    q.model = $('#e-model').value.trim();
    try { q.rubric = JSON.parse($('#e-rubric').value); } catch { throw new Error('Rubric is not valid JSON.'); }
  }
  else if (type === 'blanks') { try { q.fields = JSON.parse($('#e-fields').value); } catch { throw new Error('Fields is not valid JSON.'); } }
  else if (type === 'label') { try { q.labels = JSON.parse($('#e-labels').value); } catch { throw new Error('Labels is not valid JSON.'); } }
  else if (type === 'order') q.steps = $('#e-steps').value.split('\n').map(s => s.trim()).filter(Boolean);
  return q;
}
async function saveQuestion() {
  $('#ed-err').textContent = '';
  let q; try { q = collectQuestion(); } catch (e) { $('#ed-err').textContent = e.message; return; }
  try {
    if (editing && QUESTIONS.some(x => x.id === editing.id)) await api('/api/admin/questions/' + encodeURIComponent(editing.id), { method: 'PUT', body: JSON.stringify({ question: q }) });
    else await api('/api/admin/questions', { method: 'POST', body: JSON.stringify({ question: q }) });
    $('#ed-modal').hidden = true; await loadAll();
  } catch (e) { $('#ed-err').textContent = e.message; }
}

/* ---------- boot ---------- */
function showDash() { $('#login-card').hidden = true; $('#dash').hidden = false; $('#who-box').hidden = false; loadAll().catch(e => alert(e.message)); }
$('#btn-login').onclick = login;
$('#adm-pass').onkeydown = e => { if (e.key === 'Enter') login(); };
$('#btn-logout').onclick = logout;
$('#btn-new').onclick = () => openEditor(null);
$('#ed-cancel').onclick = () => $('#ed-modal').hidden = true;
$('#ed-save').onclick = saveQuestion;
$('#f-q').oninput = renderList; $('#f-set').onchange = () => { drawTopics(); renderList(); };
$('#f-topic').onchange = renderList; $('#f-tier').onchange = renderList; $('#f-type').onchange = renderList;
$('#ed-modal').onclick = e => { if (e.target.id === 'ed-modal') $('#ed-modal').hidden = true; };
if (token) showDash();
})();
