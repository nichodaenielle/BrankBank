# Brain Bank: The Science Showdown

A game-show style Grade 8 Semester 1 science reviewer for Cloudflare Workers. By Nichzz.

**Live:** https://science-bank-quiz.daenielledaypuyart.workers.dev

## Modes
- **Bank Board** – 5 topics × $100–$500 cards, a hidden Double Down card, and a Final Wager at the end.
- **Pop Quiz** – 10 random timed questions (2 per value tier).
- **Daily Challenge** – 5 questions, the same for everyone each day (Manila time), with a day streak.
- **Question Bank** – browse, search and try all 153 questions.
- **Review my misses** – repeats missed questions until each is answered correctly.
- **Live Classroom** – `/live?code=CLASS` projector screen with live class scores.

## Features
Auto-marked answers (keyword rubrics for explanations), halving penalty per wrong try, streak bonuses,
lifelines (50/50, Hint, +30s), badges, avatars, game-show music, shareable score cards, class codes with
section rankings, a shared online leaderboard (Competition) and a device-only leaderboard (Individual Challenge).

## Project layout
- `public/` – static app (`index.html`, `app.js`, `questions.js`, `style.css`, `live.html`, images, fonts)
- `src/worker.js` – Worker API (`/api/leaderboard`, `/api/sections`, `/api/live`) backed by a SQLite Durable Object
- `wrangler.toml` – Worker, assets and Durable Object configuration

## Deploy
```
npm install
npx wrangler login
npx wrangler deploy
```
The Durable Object uses SQLite storage, which is available on the Workers free plan.
