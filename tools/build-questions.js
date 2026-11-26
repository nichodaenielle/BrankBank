#!/usr/bin/env node
/* Build public/questions.js from content/.
   Usage: node tools/build-questions.js [--check]
   --check validates only, does not write. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SETS_FILE = path.join(ROOT, 'content', 'sets.json');
const QDIR = path.join(ROOT, 'content', 'questions');
const OUT = path.join(ROOT, 'public', 'questions.js');
const TIERS = [100, 200, 300, 400, 500];
const TYPES = ['tf', 'mc', 'short', 'multi', 'label', 'blanks', 'order', 'explain'];
const CHECK_ONLY = process.argv.includes('--check');

const errors = [];
const err = (f, msg) => errors.push(`${f}: ${msg}`);

/* ---------- tiny CSV reader (quoted fields, "" escape) ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some(x => x !== '')) rows.push(row); }
  return rows;
}
const splitList = s => String(s || '').split('|').map(x => x.trim()).filter(Boolean);

/* ---------- load sets ---------- */
const sets = JSON.parse(fs.readFileSync(SETS_FILE, 'utf8'));
for (const [id, s] of Object.entries(sets)) {
  if (!s.name || !Array.isArray(s.topics) || !s.topics.length) err('sets.json', `set "${id}" needs name + topics[]`);
  for (const t of s.topics || []) if (!t.id || !t.name) err('sets.json', `set "${id}" has a topic missing id/name`);
  s.label = s.label || `${s.icon || '📚'} ${s.name} · Grade ${s.grade} · Sem ${s.semester}`;
  s.subject = (s.subject || s.name).toLowerCase();
}

/* ---------- load questions ---------- */
const bySet = {};
for (const f of fs.readdirSync(QDIR).sort()) {
  const ext = f.endsWith('.json') ? 'json' : f.endsWith('.csv') ? 'csv' : null;
  const setId = ext && Object.keys(sets).find(id => f === id + '.' + ext || f.startsWith(id + '-'));
  if (!ext || !setId) { err(f, 'expected <set>.json|csv or <set>-<name>.json|csv where <set> is a key in sets.json'); continue; }
  (bySet[setId] = bySet[setId] || []).push(path.join(QDIR, f));
}

const seenIds = new Set();
const allQuestions = [];

function checkCommon(q, file, setId) {
  const topicOk = sets[setId].topics.some(t => t.id === q.topic);
  if (!topicOk) err(file, `${q.id || '?'}: unknown topic "${q.topic}" for set ${setId}`);
  if (!TIERS.includes(+q.tier)) err(file, `${q.id}: tier must be one of ${TIERS.join('/')}`);
  if (!TYPES.includes(q.type)) err(file, `${q.id}: unknown type "${q.type}"`);
  if (typeof q.q !== 'string' || !q.q.trim()) err(file, `${q.id}: missing question text (q)`);
  if (q.img && !fs.existsSync(path.join(ROOT, 'public', q.img))) err(file, `${q.id}: image not found: ${q.img}`);
  if (q.id && seenIds.has(q.id)) err(file, `duplicate question id "${q.id}"`);
  if (q.id) seenIds.add(q.id);
}

function checkType(q, file) {
  const need = (cond, msg) => { if (!cond) err(file, `${q.id}: ${msg}`); };
  switch (q.type) {
    case 'tf': need(typeof q.answer === 'boolean', 'tf needs answer: true|false'); break;
    case 'mc':
      need(Array.isArray(q.choices) && q.choices.length >= 2, 'mc needs choices[] (>=2)');
      need(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < (q.choices || []).length, 'mc answer must be a valid choice index');
      break;
    case 'multi':
      need(Array.isArray(q.choices) && q.choices.length >= 2, 'multi needs choices[] (>=2)');
      need(Array.isArray(q.answers) && q.answers.length && q.answers.every(i => Number.isInteger(i) && i >= 0 && i < (q.choices || []).length), 'multi needs answers[] of valid choice indexes');
      break;
    case 'short': need(typeof q.a === 'string' && q.a.trim(), 'short needs answer text (a)'); break;
    case 'explain':
      need(typeof q.model === 'string' && q.model.trim(), 'explain needs model answer');
      need(Array.isArray(q.rubric) && q.rubric.length, 'explain needs rubric[]');
      (q.rubric || []).forEach((g, gi) => {
        need(Number.isInteger(g.min) && g.min >= 1, `rubric[${gi}] needs min >= 1`);
        need(Array.isArray(g.points) && g.points.length, `rubric[${gi}] needs points[]`);
        (g.points || []).forEach((p, pi) => need(Array.isArray(p.k) && p.k.length && p.k.every(k => typeof k === 'string' && k.trim()), `rubric[${gi}].points[${pi}] needs k[] of pattern strings`));
      });
      break;
    case 'blanks':
      need(Array.isArray(q.fields) && q.fields.length, 'blanks needs fields[]');
      (q.fields || []).forEach((f, fi) => {
        need(typeof f.label === 'string' && f.label.trim(), `fields[${fi}] needs label`);
        if (f.kind === 'select') need(Array.isArray(f.options) && f.options.includes(f.answer), `fields[${fi}] select needs options[] containing answer`);
        else if (f.kind === 'num') need(f.value !== undefined && f.value !== '', `fields[${fi}] num needs value`);
        else need(typeof f.a === 'string' && f.a.trim(), `fields[${fi}] needs answer text (a)`);
      });
      break;
    case 'label': need(Array.isArray(q.labels) && q.labels.length && q.labels.every(l => Array.isArray(l) && l.length === 2), 'label needs labels[] of [name, answer] pairs'); break;
    case 'order': need(Array.isArray(q.steps) && q.steps.length >= 2, 'order needs steps[] (>=2)'); break;
  }
}

for (const [setId, files] of Object.entries(bySet)) {
  const meta = sets[setId];
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    if (file.endsWith('.json')) {
      let data; try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { err(rel, 'invalid JSON: ' + e.message); continue; }
      if (!Array.isArray(data)) { err(rel, 'JSON must be an array of question objects'); continue; }
      for (const q of data) {
        q.set = setId; q.subject = q.subject || meta.subject; q.grade = q.grade || meta.grade;
        q.semester = q.semester || meta.semester; q.tier = +q.tier;
        q.level = q.level || (q.tier <= 200 ? 1 : q.tier === 300 ? 2 : q.tier === 400 ? 3 : 4);
        checkCommon(q, rel, setId); checkType(q, rel);
        allQuestions.push(q);
      }
    } else {
      /* CSV — simple types only: tf, mc, short, multi */
      const rows = parseCSV(fs.readFileSync(file, 'utf8'));
      const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
      const col = name => head.indexOf(name);
      for (const r of rows) {
        const g = n => (col(n) >= 0 ? (r[col(n)] || '').trim() : '');
        const q = { set: setId, subject: meta.subject, grade: meta.grade, semester: meta.semester, id: g('id'), topic: g('topic'), tier: +g('tier'), type: g('type'), q: g('q') };
        const why = g('why'), img = g('img'), src = g('src');
        if (why) q.why = why; if (img) q.img = img; if (src) q.src = src;
        if (q.type === 'tf') q.answer = /^t|true|yes/i.test(g('answer'));
        else if (q.type === 'mc' || q.type === 'multi') {
          q.choices = splitList(g('choices'));
          const idx = s => splitList(s).map(x => parseInt(x, 10) - 1);
          if (q.type === 'mc') q.answer = idx(g('answer'))[0]; else q.answers = idx(g('answers'));
        } else if (q.type === 'short') {
          q.a = g('answer');
          const acc = splitList(g('acc')); if (acc.length) q.acc = acc;
          const rej = splitList(g('rej')); if (rej.length) q.rej = rej;
        } else { err(rel, `${q.id || '?'}: CSV only supports tf/mc/short/multi — use JSON for ${q.type || 'this type'}`); continue; }
        q.level = q.tier <= 200 ? 1 : q.tier === 300 ? 2 : q.tier === 400 ? 3 : 4;
        checkCommon(q, rel, setId); checkType(q, rel);
        allQuestions.push(q);
      }
    }
  }
}

/* ---------- emit ---------- */
if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) found:`);
  errors.slice(0, 50).forEach(e => console.error('  ' + e));
  if (errors.length > 50) console.error(`  …and ${errors.length - 50} more`);
  process.exit(1);
}

const esc = s => JSON.stringify(s);
const setEntries = Object.entries(sets).map(([id, s]) => {
  const topics = s.topics.map(t => `{ id:${esc(t.id)}, name:${esc(t.name)}, icon:${esc(t.icon || '')} }`).join(', ');
  return `  ${esc(id)}: { id:${esc(id)}, name:${esc(s.name)}, grade:${s.grade}, semester:${s.semester}, icon:${esc(s.icon || '📚')}, label:${esc(s.label)}, topics:[${topics}] }`;
});
const firstTopics = sets[Object.keys(sets)[0]].topics
  .map(t => `{ id:${esc(t.id)}, name:${esc(t.name)}, icon:${esc(t.icon || '')} }`).join(',\n  ');

const out = `/* AUTO-GENERATED by tools/build-questions.js — edit files in content/ instead.
   Source: "Semester 1 Assessment Reviewer (open-ended question) Dec. 2026-27".
   src:'deck' = answer from the deck; src:'added' = answer key written for prompts without one / derived practice items.
   Types: tf, mc, short, multi, label, blanks, order, explain. Tier = $ value. Level 1-4 derived from tier. */
window.TOPICS = [
  ${firstTopics}
];

window.QUESTIONS = [
${allQuestions.map(q => JSON.stringify(q)).join(',\n')}
];

/* ---------- set registry & per-question defaults ----------
   A "set" is one playable collection (subject + grade + semester). Each set owns its
   topic list; questions carry set/subject/grade/semester/level so future sets can be
   added without touching game code. */
window.SETS = {
${setEntries.join(',\n')}
};
`;

if (CHECK_ONLY) { console.log(`✓ ${allQuestions.length} questions valid across ${Object.keys(sets).length} set(s)`); }
else {
  fs.writeFileSync(OUT, out);
  console.log(`✓ wrote ${path.relative(ROOT, OUT)} — ${allQuestions.length} questions, ${Object.keys(sets).length} set(s)`);
}
