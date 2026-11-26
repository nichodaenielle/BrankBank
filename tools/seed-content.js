#!/usr/bin/env node
/* Seed the live question bank into the Worker's Durable Object.
   Usage: ADMIN_URL=https://science-bank-quiz.<acct>.workers.dev ADMIN_PASSWORD=xxx node tools/seed-content.js
   Run `npm run build:questions` first so public/questions.js is current. */
'use strict';
const path = require('path');

global.window = {};
require(path.join(__dirname, '..', 'public', 'questions.js'));
const { SETS, QUESTIONS } = window;

const URL_BASE = process.env.ADMIN_URL || 'http://127.0.0.1:8787';
const PASSWORD = process.env.ADMIN_PASSWORD || '';

(async () => {
  if (!PASSWORD) { console.error('Set ADMIN_PASSWORD env var'); process.exit(1); }
  const login = await fetch(URL_BASE + '/api/admin/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: PASSWORD })
  }).then(r => r.json());
  if (!login.token) { console.error('Login failed:', login.error || 'no token'); process.exit(1); }
  const res = await fetch(URL_BASE + '/api/admin/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + login.token },
    body: JSON.stringify({ sets: SETS, questions: QUESTIONS })
  }).then(r => r.json());
  console.log(res.ok ? `✓ imported ${res.imported} items` : 'Import failed', res.errors?.length ? res.errors : '');
})();
