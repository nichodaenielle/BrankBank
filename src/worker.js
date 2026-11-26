import { DurableObject } from 'cloudflare:workers';

const MODES = { game: 25000, pop: 6000, daily: 3000 };
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
    this.lastPost = new Map();
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
    if (['/api/leaderboard', '/api/sections', '/api/live'].includes(url.pathname))
      return env.LB.get(env.LB.idFromName('global')).fetch(request);
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(request);
  }
};
