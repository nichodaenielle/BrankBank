# Brain Bank — Multi-Subject & Multi-Level Expansion Plan

Goal: let Brain Bank accommodate specific topics, difficulty levels, and eventually all
grade levels / subjects — not just Grade 8 Science Semester 1.

## Current architecture

- **Content**: `public/questions.js` — flat `QUESTIONS` array (153 items) + hardcoded
  `TOPICS` (5). Each question has `topic`, `tier` (100–500 — currently *both* point value
  and de-facto difficulty), `type` (9 auto-marked types), `src`, and answer data
  (`answer`/`acc`/`choices`/`model`+`rubric`/`fields`).
- **Word Puzzle**: `public/words.js` — `[ANSWER, topic, clue]` triples feeding a seeded
  crossword builder.
- **Game logic** (`app.js`): assumes exactly 5 topics × 5 tiers for Bank Board;
  `pool()`, `dailyQueue()`, `startGame()` filter by topic/tier. `MAX` score caps are
  hardcoded per mode.
- **Backend** (`src/worker.js`): one SQLite Durable Object (`Leaderboard`) keyed by
  `mode` ∈ {game, pop, daily, word}. Scores are self-reported, name-keyed, IP-throttled.
  No subject/grade/topic dimensions. `MODES` caps are hardcoded.

---

## Phase 0 — Decouple the data model (foundation)

`tier` currently means "dollar value" *and* "difficulty" *and* "board slot." Separate them:

```js
{ id, subject:'science', grade:8, semester:1,
  topic:'gen',            // -> topics registry, not hardcoded
  tier:300,               // points/$ value only
  level:2,                // NEW: difficulty 1-5, independent of tier
  type:'explain', src:'deck', ... }
```

- Introduce a **set registry**: `window.SETS = { 'sci-g8s1': { name, grade, icon,
  subjects/topics:[...] } }` replacing the global `TOPICS` assumption.
- Keep `tier` as points; add `level` (initially derived from tier:
  100/200 -> L1, 300 -> L2, 400 -> L3, 500 -> L4) so existing questions need no
  re-authoring.
- **Backward compat**: existing 153 questions default to
  `subject:'science', grade:8, semester:1` at load time — no data migration.

## Phase 1 — Subject/Grade selection ("all levels")

- **Welcome screen**: add a Subject/Set picker (dropdown or carousel) above the
  challenge modes. Starts with one option (`Science · Grade 8 · Sem 1`); scales to many.
- **Bank Board**: generalize the hardcoded 5x5 grid to `N topics x M tiers` rendered
  dynamically from the selected set. Score cap becomes `topics x sum(tiers)` computed
  per set instead of `MAX.game = 8000`.
- **Pop Quiz / Daily / Review**: already topic-agnostic — filter `QUESTIONS` by the
  active set. Add optional **topic filter** ("Pop Quiz: Earth & Climate only").
- **Word Puzzle**: `WORDS` entries already carry topic — filter by active set or allow
  topic-scoped puzzles.
- **Question Bank**: add subject/grade/topic/difficulty filters (topic+tier+search
  already exist).
- **Difficulty**: Easy/Medium/Hard selector mapping to level ranges; longer-term
  adaptive difficulty based on running accuracy.

## Phase 2 — Backend: multi-dimensional leaderboards

Current DO schema can't separate sets. Extend:

```sql
scores(..., subject TEXT, grade INT, topic TEXT, level INT, set TEXT)
-- leaderboard key becomes (set|mode|topic?, day)
```

- API: `GET /api/leaderboard?set=sci-g8s1&mode=game&topic=` — old params keep working
  (default to the current set) for backward compat.
- `MODES` caps become per-set (sets table or set metadata), not global constants.
- **Migration**: existing rows get `set='sci-g8s1'`; old queries unchanged.
- New endpoints: `GET /api/sets` (list sets + question counts).

## Phase 3 — Content pipeline (the real long-term cost)

Scaling lives or dies on authoring workflow:

1. **Authoring format**: split into `content/sets/<set>.js` files, one per
   subject/grade/semester, still `window`-registered, loaded via script tags or
   dynamic import.
2. **Validation script** (`npm run validate`): check required fields per type,
   `acc`/`choices`/`rubric` sanity, unique IDs, valid topic refs, image files exist.
   Run before deploy — malformed answer keys silently auto-fail students.
3. **Images**: `public/img/<set>/` to avoid cross-subject collisions.
4. **Review workflow**: extend `src` provenance with `reviewedBy`/`date` for
   teacher sign-off.
5. **Coverage targets**: per-set quotas (e.g. >=15 questions per topic per tier band)
   so Pop Quiz/Daily never starve — the daily seed picker needs depth per day.

## Phase 4 — New modes unlocked by the model

- **Topic Rush**: single-topic timed board
- **Exam Simulator**: full-set mixed quiz mirroring the real exam blueprint
- **Boss Battle / Final Wager per topic**
- **Class assignments**: teacher code -> specific set/topic; `/live` classroom screen
  already supports this pattern
- **Badges per set**: generic badges + set-specific extras

## Phase 5 — Optional: dynamic content (only if needed)

If teachers must add questions without redeploying:
- Move question JSON into the Durable Object (or D1/KV), `GET /api/content?set=`,
  versioned, client-cached.
- Adds auth (teacher tokens), admin UI, moderation — **defer until real demand**;
  static files are simpler, git-versioned, and free.

---

## Suggested order

| Phase | Scope | Effort |
|---|---|---|
| 0 | Data model + set registry, defaults for existing content | Small — mostly refactor |
| 1 | Set picker UI + dynamic board + topic filters | Medium — welcome screen, board render, mode launches |
| 2 | DO schema migration + API params | Medium — careful migration, backward compat |
| 3 | Content pipeline + validator + file split | Ongoing — bulk of work is authoring questions |
| 4-5 | New modes, dynamic content | As needed |

## Risks

- Score caps and leaderboards assume fixed mode totals — must become per-set.
- Scores are self-reported (cheatable); more subjects = more incentive — consider
  server-side answer verification later.
- DO SQLite growth — fine for now, monitor.
