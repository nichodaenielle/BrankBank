import { DurableObject } from 'cloudflare:workers';

const MODES = { game: 25000, pop: 6000, daily: 3000, word: 8000 };
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const cleanName = n => String(n || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
const cleanCls = c => String(c || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
const cleanAvatar = a => /^b\d{1,2}f\d{1,2}s\d{1,2}c\d{1,2}a\d{1,2}$/.test(a) ? a : cleanEmoji(a);
const cleanEmoji = a => [...String(a || '').replace(/[\u0000-\u001f<>&"'A-Za-z0-9]/g, '')].slice(0, 4).join('').slice(0, 12);
const cleanBadges = b => (Array.isArray(b) ? b : []).filter(x => /^[a-z0-9]{2,12}$/.test(x)).slice(0, 12).join(',');
const manilaDay = (t = Date.now()) => new Date(t + 8 * 3600e3).toISOString().slice(0, 10);
const int = v => Math.round(Number(v));

export class Leaderboard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, key TEXT NOT NULL, mode TEXT NOT NULL,
      score INTEGER NOT NULL, correct INTEGER NOT NULL, total INTEGER NOT NULL, ms INTEGER NOT NULL, ts INTEGER NOT NULL)`);
    for (const col of ['avatar', 'cls', 'badges', 'day']) {
      try { this.sql.exec(`ALTER TABLE scores ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`); } catch {}
    }
    this.sql.exec('CREATE INDEX IF NOT EXISTS idx_mode_score ON scores(mode, score DESC)');
    this.sql.exec(`CREATE TABLE IF NOT EXISTS live (
      cls TEXT NOT NULL, key TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT NOT NULL, kind TEXT NOT NULL,
      score INTEGER NOT NULL, answered INTEGER NOT NULL, correct INTEGER NOT NULL, streak INTEGER NOT NULL,
      done INTEGER NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (cls, key))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY, qset TEXT NOT NULL, topic TEXT NOT NULL, tier INTEGER NOT NULL,
      type TEXT NOT NULL, data TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sets (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL)`);
    this.lastPost = new Map();
  }

  /* ---------- question content ---------- */
  setsAll() {
    return this.sql.exec('SELECT id, data FROM sets').toArray().map(r => ({ id: r.id, ...JSON.parse(r.data) }));
  }
  questionsAll(set = '') {
    const rows = set
      ? this.sql.exec('SELECT data FROM questions WHERE qset = ? ORDER BY topic, tier, id', set).toArray()
      : this.sql.exec('SELECT data FROM questions ORDER BY qset, topic, tier, id').toArray();
    return rows.map(r => JSON.parse(r.data));
  }
  upsertSet(s) {
    this.sql.exec('INSERT INTO sets (id, data) VALUES (?,?) ON CONFLICT (id) DO UPDATE SET data=excluded.data',
      s.id, JSON.stringify(s));
  }
  upsertQuestion(q) {
    this.sql.exec(`INSERT INTO questions (id, qset, topic, tier, type, data) VALUES (?,?,?,?,?,?)
      ON CONFLICT (id) DO UPDATE SET qset=excluded.qset, topic=excluded.topic, tier=excluded.tier, type=excluded.type, data=excluded.data`,
      q.id, q.set, q.topic, q.tier, q.type, JSON.stringify(q));
  }

  validateQuestion(q) {
    if (!q || typeof q !== 'object') return 'question must be an object';
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/i.test(q.id || '')) return 'id must be 2-41 chars: letters, numbers, dashes';
    if (!['tf', 'mc', 'short', 'multi', 'label', 'blanks', 'order', 'explain'].includes(q.type)) return 'unknown type';
    if (![100, 200, 300, 400, 500].includes(+q.tier)) return 'tier must be 100-500';
    if (typeof q.q !== 'string' || q.q.trim().length < 3) return 'question text (q) required';
    const set = this.sql.exec('SELECT data FROM sets WHERE id = ?', q.set).toArray()[0];
    if (!set) return 'unknown set "' + q.set + '"';
    const topics = JSON.parse(set.data).topics.map(t => t.id);
    if (!topics.includes(q.topic)) return 'unknown topic "' + q.topic + '" for set ' + q.set;
    const need = (cond, msg) => { if (!cond) throw new Error(msg); };
    try {
      switch (q.type) {
        case 'tf': need(typeof q.answer === 'boolean', 'tf needs answer true/false'); break;
        case 'mc': need(Array.isArray(q.choices) && q.choices.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, 'mc needs choices[] and valid answer index'); break;
        case 'multi': need(Array.isArray(q.choices) && q.choices.length >= 2 && Array.isArray(q.answers) && q.answers.length && q.answers.every(i => Number.isInteger(i) && i >= 0 && i < q.choices.length), 'multi needs choices[] and answers[]'); break;
        case 'short': need(typeof q.a === 'string' && q.a.trim(), 'short needs answer text (a)'); break;
        case 'explain': need(typeof q.model === 'string' && q.model.trim() && Array.isArray(q.rubric) && q.rubric.length, 'explain needs model + rubric[]'); break;
        case 'blanks': need(Array.isArray(q.fields) && q.fields.length, 'blanks needs fields[]'); break;
        case 'label': need(Array.isArray(q.labels) && q.labels.length, 'label needs labels[]'); break;
        case 'order': need(Array.isArray(q.steps) && q.steps.length >= 2, 'order needs steps[] (>=2)'); break;
      }
    } catch (e) { return e.message; }
    return null;
  }

  validateSet(s, existingId = '') {
    if (!s || typeof s !== 'object') return 'set must be an object';
    if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(s.id || '')) return 'set id must be 2-31 chars: lowercase letters, numbers, dashes';
    if (existingId && s.id !== existingId) return 'set id cannot be changed';
    if (typeof s.name !== 'string' || !s.name.trim()) return 'set needs a name';
    if (!Number.isFinite(+s.grade) || +s.grade < 1 || +s.grade > 12) return 'grade must be 1-12';
    if (!Number.isFinite(+s.semester) || +s.semester < 1 || +s.semester > 3) return 'semester must be 1-3';
    if (!Array.isArray(s.topics) || !s.topics.length) return 'set needs at least one topic';
    const ids = new Set();
    for (const t of s.topics) {
      if (!t || typeof t !== 'object') return 'each topic must be an object';
      if (!/^[a-z0-9][a-z0-9-]{0,30}$/.test(t.id || '')) return 'topic id must be lowercase letters, numbers, dashes';
      if (ids.has(t.id)) return 'duplicate topic id "' + t.id + '"';
      ids.add(t.id);
      if (typeof t.name !== 'string' || !t.name.trim()) return 'topic "' + t.id + '" needs a name';
      if (t.icon !== undefined && typeof t.icon !== 'string') return 'topic icon must be text';
    }
    return null;
  }

  async adminToken(request) {
    const t = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!t) return false;
    const row = this.sql.exec('SELECT expires FROM sessions WHERE token = ?', t).toArray()[0];
    if (!row || row.expires < Date.now()) return false;
    return true;
  }

  async admin(request, url) {
    const p = url.pathname;
    if (p === '/api/admin/login' && request.method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      const pass = request.headers.get('x-bb-admin-pass') || this.env.ADMIN_PASSWORD;
      if (!pass) return json({ error: 'admin not configured' }, 503);
      if (b.password !== pass) return json({ error: 'wrong password' }, 401);
      const token = crypto.randomUUID();
      this.sql.exec('INSERT INTO sessions (token, expires) VALUES (?,?)', token, Date.now() + 12 * 3600e3);
      return json({ token, expiresIn: 43200 });
    }
    if (url.pathname === '/api/content' && request.method === 'GET') {
      const set = /^[a-z0-9-]+$/.test(url.searchParams.get('set') || '') ? url.searchParams.get('set') : '';
      const sets = {};
      for (const s of this.setsAll()) sets[s.id] = s;
      return json({ sets, questions: this.questionsAll(set) });
    }
    if (!(await this.adminToken(request))) return json({ error: 'unauthorized — log in first' }, 401);
    if (p === '/api/admin/logout' && request.method === 'POST') {
      const t = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      this.sql.exec('DELETE FROM sessions WHERE token = ?', t);
      return json({ ok: true });
    }
    if (p === '/api/admin/questions' && request.method === 'GET') {
      const set = /^[a-z0-9-]+$/.test(url.searchParams.get('set') || '') ? url.searchParams.get('set') : '';
      return json({ questions: this.questionsAll(set) });
    }
    if (p === '/api/admin/questions' && request.method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      return this.saveQuestion(b.question);
    }
    const one = p.match(/^\/api\/admin\/questions\/([^/]+)$/);
    if (one && request.method === 'PUT') {
      let b; try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      if (decodeURIComponent(one[1]) !== (b.question && b.question.id)) return json({ error: 'id mismatch' }, 400);
      return this.saveQuestion(b.question);
    }
    if (one && request.method === 'DELETE') {
      this.sql.exec('DELETE FROM questions WHERE id = ?', decodeURIComponent(one[1]));
      return json({ ok: true });
    }
    if (p === '/api/admin/sets' && request.method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      const err = this.validateSet(b.set);
      if (err) return json({ error: err }, 400);
      const s = { ...b.set, name: b.set.name.trim(), grade: +b.set.grade, semester: +b.set.semester,
        icon: String(b.set.icon || '📚').slice(0, 8), subject: String(b.set.subject || b.set.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general',
        label: String(b.set.label || `${b.set.icon || '📚'} ${b.set.name.trim()} · Grade ${b.set.grade} · Sem ${b.set.semester}`).slice(0, 60),
        topics: b.set.topics.map(t => ({ id: t.id, name: t.name.trim(), icon: String(t.icon || '').slice(0, 8) })) };
      this.upsertSet(s);
      return json({ ok: true, set: s });
    }
    const setOne = p.match(/^\/api\/admin\/sets\/([^/]+)$/);
    if (setOne && request.method === 'PUT') {
      let b; try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      const id = decodeURIComponent(setOne[1]);
      if (!b.set || b.set.id !== id) return json({ error: 'set id cannot be changed' }, 400);
      const err = this.validateSet(b.set, id);
      if (err) return json({ error: err }, 400);
      const s = { ...b.set, name: b.set.name.trim(), grade: +b.set.grade, semester: +b.set.semester,
        icon: String(b.set.icon || '📚').slice(0, 8),
        label: String(b.set.label || `${b.set.icon || '📚'} ${b.set.name.trim()} · Grade ${b.set.grade} · Sem ${b.set.semester}`).slice(0, 60),
        topics: b.set.topics.map(t => ({ id: t.id, name: t.name.trim(), icon: String(t.icon || '').slice(0, 8) })) };
      this.upsertSet(s);
      return json({ ok: true, set: s });
    }
    if (setOne && request.method === 'DELETE') {
      const id = decodeURIComponent(setOne[1]);
      const n = this.sql.exec('SELECT COUNT(*) c FROM questions WHERE qset = ?', id).one().c;
      if (n) return json({ error: `Set has ${n} question(s) — reassign or delete them first` }, 400);
      this.sql.exec('DELETE FROM sets WHERE id = ?', id);
      return json({ ok: true });
    }
    if (p === '/api/admin/import' && request.method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      let n = 0, bad = [];
      for (const s of Object.values(b.sets || {})) { if (s && s.id) { this.upsertSet(s); n++; } }
      for (const q of b.questions || []) {
        const err = this.validateQuestion(q);
        if (err) { bad.push(`${q.id || '?'}: ${err}`); continue; }
        this.upsertQuestion(q); n++;
      }
      return json({ ok: true, imported: n, errors: bad.slice(0, 20) });
    }
    return json({ error: 'not found' }, 404);
  }

  saveQuestion(q) {
    const err = this.validateQuestion(q);
    if (err) return json({ error: err }, 400);
    const set = this.sql.exec('SELECT data FROM sets WHERE id = ?', q.set).toArray()[0];
    const meta = JSON.parse(set.data);
    q.subject = meta.subject || meta.name.toLowerCase();
    q.grade = meta.grade; q.semester = meta.semester;
    q.level = q.level || (q.tier <= 200 ? 1 : q.tier === 300 ? 2 : q.tier === 400 ? 3 : 4);
    this.upsertQuestion(q);
    return json({ ok: true, question: q });
  }

  throttle(id, ms) {
    const now = Date.now();
    if (this.lastPost.size > 5000) this.lastPost.clear();
    if (now - (this.lastPost.get(id) || 0) < ms) return true;
    this.lastPost.set(id, now);
    return false;
  }

  filtered(mode, cls, day) {
    return [`SELECT * FROM scores WHERE mode = ? AND (? = '' OR cls = ?) AND (? = '' OR day = ?)`, [mode, cls, cls, day, day]];
  }

  top(mode, cls = '', day = '', limit = 50) {
    const [q, args] = this.filtered(mode, cls, day);
    return this.sql.exec(
      `SELECT name, avatar, badges, cls, score, correct, total, ms, ts FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY key ORDER BY score DESC, ms ASC) rn FROM (${q})
       ) WHERE rn = 1 ORDER BY score DESC, ms ASC LIMIT ?`, ...args, limit).toArray();
  }

  rankOf(mode, key, cls = '', day = '') {
    const [q, args] = this.filtered(mode, cls, day);
    const best = this.sql.exec(`SELECT MAX(score) s FROM (${q}) WHERE key = ?`, ...args, key).one().s;
    const better = this.sql.exec(`SELECT COUNT(*) c FROM (SELECT key, MAX(score) s FROM (${q}) GROUP BY key) WHERE s > ?`, ...args, best).one().c;
    const players = this.sql.exec(`SELECT COUNT(DISTINCT key) c FROM (${q})`, ...args).one().c;
    return { rank: better + 1, best, players };
  }

  sections(mode, day = '') {
    return this.sql.exec(
      `SELECT cls, COUNT(*) players, SUM(s) total, MAX(s) best, CAST(AVG(s) AS INTEGER) avg FROM (
         SELECT cls, key, MAX(score) s FROM scores WHERE mode = ? AND cls <> '' AND (? = '' OR day = ?) GROUP BY cls, key
       ) GROUP BY cls ORDER BY total DESC LIMIT 30`, mode, day, day).toArray();
  }

  async fetch(request) {
    const url = new URL(request.url), p = url.searchParams;
    const ip = request.headers.get('cf-connecting-ip') || 'x';
    if (url.pathname === '/api/content' || url.pathname.startsWith('/api/admin/')) return this.admin(request, url);
    const qMode = MODES[p.get('mode')] ? p.get('mode') : 'game';
    const qDay = qMode === 'daily' ? (/^\d{4}-\d{2}-\d{2}$/.test(p.get('day') || '') ? p.get('day') : manilaDay()) : '';

    if (url.pathname === '/api/sections' && request.method === 'GET')
      return json({ mode: qMode, day: qDay, sections: this.sections(qMode, qDay) });

    if (url.pathname === '/api/live') {
      if (request.method === 'GET') {
        const cls = cleanCls(p.get('cls'));
        if (!cls) return json({ error: 'class code required' }, 400);
        const players = this.sql.exec(
          'SELECT name, avatar, kind, score, answered, correct, streak, done, ts FROM live WHERE cls = ? AND ts > ? ORDER BY score DESC, ts ASC LIMIT 100',
          cls, Date.now() - 3 * 3600e3).toArray();
        return json({ cls, now: Date.now(), players });
      }
      if (request.method === 'POST') {
        let b; try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
        const cls = cleanCls(b.cls), name = cleanName(b.name), kind = MODES[b.kind] ? b.kind : 'game';
        const score = int(b.score), answered = int(b.answered), correct = int(b.correct), streak = int(b.streak);
        if (!cls || !name) return json({ error: 'class code and name required' }, 400);
        if (![score, answered, correct, streak].every(Number.isFinite) || score < 0 || score > MODES[kind] ||
            answered < 0 || answered > 60 || correct < 0 || correct > answered || streak < 0 || streak > 60)
          return json({ error: 'invalid' }, 400);
        const key = name.toLowerCase();
        if (this.throttle('live|' + ip + '|' + cls + '|' + key, 700)) return json({ error: 'slow down' }, 429);
        const now = Date.now();
        this.sql.exec(`INSERT INTO live (cls, key, name, avatar, kind, score, answered, correct, streak, done, ts) VALUES (?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT (cls, key) DO UPDATE SET name=excluded.name, avatar=excluded.avatar, kind=excluded.kind, score=excluded.score,
          answered=excluded.answered, correct=excluded.correct, streak=excluded.streak, done=excluded.done, ts=excluded.ts`,
          cls, key, name, cleanAvatar(b.avatar), kind, score, answered, correct, streak, b.done ? 1 : 0, now);
        if (Math.random() < 0.02) this.sql.exec('DELETE FROM live WHERE ts < ?', now - 12 * 3600e3);
        return json({ ok: true });
      }
      return json({ error: 'method not allowed' }, 405);
    }

    if (request.method === 'GET')
      return json({ mode: qMode, day: qDay, entries: this.top(qMode, cleanCls(p.get('cls')), qDay) });

    if (request.method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      const mode = b.mode;
      if (!MODES[mode]) return json({ error: 'bad mode' }, 400);
      const name = cleanName(b.name);
      if (!name) return json({ error: 'name required' }, 400);
      const score = int(b.score), correct = int(b.correct), total = int(b.total), ms = int(b.ms);
      if (![score, correct, total, ms].every(Number.isFinite) || score < 0 || score > MODES[mode] ||
          total < 1 || total > 60 || correct < 0 || correct > total || ms < 0 || (mode === 'daily' && total > 5))
        return json({ error: 'invalid score' }, 400);
      const now = Date.now();
      let day = '';
      if (mode === 'daily') {
        day = String(b.day || '');
        if (day !== manilaDay(now) && day !== manilaDay(now - 6 * 3600e3)) return json({ error: 'daily challenge has ended' }, 400);
      }
      const key = name.toLowerCase(), cls = cleanCls(b.cls);
      if (this.throttle(ip + '|' + key, 4000)) return json({ error: 'too many submissions, wait a few seconds' }, 429);
      this.sql.exec('INSERT INTO scores (name, key, mode, score, correct, total, ms, ts, avatar, cls, badges, day) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        name, key, mode, score, correct, total, ms, now, cleanAvatar(b.avatar), cls, cleanBadges(b.badges), day);
      const out = { ok: true, ...this.rankOf(mode, key, '', day), entries: this.top(mode, '', day) };
      if (cls) out.classRank = this.rankOf(mode, key, cls, day);
      return json(out);
    }
    return json({ error: 'method not allowed' }, 405);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (['/api/leaderboard', '/api/sections', '/api/live', '/api/content'].includes(url.pathname) || url.pathname.startsWith('/api/admin/')) {
      let req = request;
      if (env.ADMIN_PASSWORD && url.pathname.startsWith('/api/admin/')) {
        const headers = new Headers(request.headers);
        headers.set('x-bb-admin-pass', env.ADMIN_PASSWORD);
        req = new Request(request, { headers });
      }
      return env.LB.get(env.LB.idFromName('global')).fetch(req);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(request);
  }
};
