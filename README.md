# Brain Bank: The Quiz Showdown

A game-show style quiz platform for Cloudflare Workers — multiple question sets across subjects and grades (Science Grade 8 Sem 1 included). By Nichzz.

**Live:** https://science-bank-quiz.daenielledaypuyart.workers.dev

A landing page introduces the game; Play Now leads to the name and mode screen.

## Modes
- **Bank Board** – every topic in the set × $100–$500 cards, a hidden Double Down card, and a Final Wager at the end.
- **Pop Quiz** – 10 random timed questions (2 per value tier).
- **Daily Challenge** – 5 questions, the same for everyone each day (Manila time), with a day streak.
- **Word Puzzle** – a fresh 10-word themed crossword every game, with its own leaderboard.
- **Question Bank** – browse, search and try every question in the active set.
- **Review my misses** – repeats missed questions until each is answered correctly.
- **Live Classroom** – `/live?code=CLASS&set=SET` projector screen with live class scores.

## Question sets & admin
Sets are defined in `content/sets.json` + `content/questions/` and pushed to the Durable Object via `tools/seed-content.js`, or managed live at `/admin` (password-protected): create sets/topics, add/edit/delete questions — changes go live instantly. `/api/content` serves all sets + questions; leaderboards are scoped per set (`?set=`).

## Features
Auto-marked answers (keyword rubrics for explanations), halving penalty per wrong try, streak bonuses,
lifelines (50/50, Hint, +30s), badges, a custom avatar builder (body, face, shoes, color, aura), game-show music, shareable score cards, class codes with
section rankings, a shared online leaderboard (Competition) and a device-only leaderboard (Individual Challenge).

## Project layout
- `public/` – static app (`index.html`, `app.js`, `questions.js`, `style.css`, `live.html`, images, fonts)
- `src/worker.js` – Worker API (`/api/leaderboard`, `/api/sections`, `/api/live`) backed by a SQLite Durable Object
- `wrangler.toml` – Worker, assets and Durable Object configuration

## Admin panel (teachers)

`/admin` lets teachers add, edit and delete questions without touching code.
Questions are stored in the Worker's Durable Object and served via `/api/content`
(the static `questions.js` remains as an offline fallback).

**Setup (one time):**
```
npx wrangler secret put ADMIN_PASSWORD   # enter a strong password
ADMIN_URL=https://science-bank-quiz.<acct>.workers.dev ADMIN_PASSWORD=<pw> node tools/seed-content.js
```
For local dev, put `ADMIN_PASSWORD=...` in `.dev.vars` (gitignored) or `[vars]` in wrangler.toml.

Content files in `content/` remain the source of truth for bulk edits — re-run
`npm run build:questions` then the seed script to push changes live.

## Deploy
```
npm install
npx wrangler login
npx wrangler deploy
```
The Durable Object uses SQLite storage, which is available on the Workers free plan.
