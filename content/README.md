# Question content — how teachers add & correct questions

Brain Bank's question bank lives in `content/` and is compiled into
`public/questions.js` by a build script. **Never edit `public/questions.js`
directly** — it is auto-generated and will be overwritten.

## Workflow

1. Edit or add files in `content/`
2. Run `npm run build:questions` (validates + regenerates `questions.js`)
3. Run `npm run check:questions` any time to validate without writing
4. Commit, push, `npx wrangler deploy`

## Files

| File | Purpose |
|---|---|
| `content/sets.json` | Question sets (subject + grade + semester + topics). Add a new set here to support another subject/level. |
| `content/questions/<set>.json` | Full questions for a set — **all 8 types supported** |
| `content/questions/<set>-<name>.csv` | Simple questions (tf, mc, short, multi only) — spreadsheet friendly |
| `content/TEMPLATE.csv` | Copy this as a starting point for CSV entries |

Filenames must start with a set id from `sets.json` (e.g. `sci-g8s1.csv`,
`sci-g8s1-extra.json`). You can split a set across several files.

## Question fields (JSON)

```json
{ "id": "g99", "topic": "gen", "tier": 300, "type": "mc",
  "q": "Question text?", "choices": ["A", "B", "C"], "answer": 0,
  "why": "Explanation shown after answering", "img": "img/photo.webp",
  "src": "added" }
```

- `id` — unique, lowercase letters/numbers/dashes (e.g. `g99`, `my-q1`)
- `topic` — must be a topic `id` from `sets.json` for that set
- `tier` — 100, 200, 300, 400 or 500 (= dollar value / board slot)
- `type` — `tf`, `mc`, `short`, `multi`, `label`, `blanks`, `order`, `explain`
- `level` — optional; auto-derived from tier (≤200→1, 300→2, 400→3, 500→4)
- `src` — `deck` (from the reviewer deck) or `added` (teacher-written)

Type-specific answer fields:

| type | required fields |
|---|---|
| `tf` | `answer: true/false` |
| `mc` | `choices[]`, `answer` = 0-based index |
| `multi` | `choices[]`, `answers[]` = 0-based indexes |
| `short` | `a` = correct text; `acc[]` = accepted alternatives; `rej[]` = rejected phrases |
| `explain` | `model` = model answer; `rubric[]` = auto-marking groups `{min, points:[{t,k}]}` |
| `blanks` | `fields[]` = `{label, kind:'select'|'num'|text, options?/answer?/value?/a?}` |
| `label` | `labels[]` = `[[name, answer], ...]` |
| `order` | `steps[]` = ordered strings |

## CSV columns (simple types only)

```
id,topic,tier,type,q,answer,acc,reject,choices,answers,why,img,src
```

- `tf` → `answer` = `true`/`false`
- `mc` → `answer` = **1-based** choice number; `choices` = options separated by `|`
- `multi` → `answers` = 1-based numbers separated by `|` (e.g. `1|3`)
- `short` → `answer` = correct text; `acc` = accepted alternatives separated by `|`; `rej` = rejected phrases
- Quote any cell containing a comma. Use `""` for a literal quote.
- `explain`, `blanks`, `label`, `order` are **JSON only** — their nested
  structures don't fit a flat row. The validator will reject them in CSV.

## Rules the validator enforces

- Unique question ids across **all** files
- `topic` must exist in the set's topic list
- `tier` must be 100–500; `type` must be known
- Required answer fields per type (see table above)
- `img` paths must exist under `public/`

## Tips for good questions

- **short**: list every reasonable spelling in `acc` (e.g. `fertilization|fertilisation`)
- **explain**: write the `model` answer first, then rubric `k` patterns as
  `synonym1|synonym2` groups — the auto-marker checks for these keywords
- Keep `tier` honest: $100 = recall, $500 = explain/compare/evaluate
- Images go in `public/img/` and are referenced as `img/filename.webp`
