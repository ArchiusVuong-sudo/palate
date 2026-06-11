# Palate — AI marketing studio for restaurants

> **Live demo:** [palate-psi.vercel.app](https://palate-psi.vercel.app) — sign in with `owner@marlowandsage.com` / `palate2026`
> **Submission report:** [docs/report/Palate_Submission_Report.pdf](docs/report/Palate_Submission_Report.pdf) (answers all 4 assignment steps + both bonus questions)
> Long agent runs and the Chrome connection wizard are best experienced locally (`pnpm install && pnpm dev`) — serverless caps runs at 5 minutes.

Built as the AT Solutions take-home ("AI Agent Solutions Consultant"), implemented end-to-end instead of on paper: all four workflow steps from the brief run as a single collaborating agent system for a fictional Australian F&B group, **Marlow & Sage** (Surry Hills · Fitzroy · Burleigh Heads).

| Step in the brief | In Palate |
| --- | --- |
| 1. Social listening & data collection | **Listening** — agent analyses Google Reviews / Facebook / Instagram items, tags sentiment/topics/dishes, flags safety issues, saves evidence-backed insights, pushes live charts |
| 2. Daily content briefing | **Briefs** — agent turns insights + brand knowledge into a designer-ready structured brief, refinable via chat feedback |
| 3. Visual content generation | **Creative** — Gemini (`gemini-3.1-flash-image` / `gemini-3-pro-image`) multi-variant stories & feed posts, image editing, Veo 3.1 video, captions A/B |
| 4. Brand consistency review | **Review** — rubric scoring against the brand contract, Gemini-annotated markup of visual issues, pass/flag/reject, human approval gate before anything ships |

**Bonus (end-to-end flow)**: the *Run full pipeline* button chains all four with human approval gates inline — the honest answer to "can one button do everything?" is "yes, with two taps from you in the middle."

## Architecture

- **Next.js 16 (App Router)** — server components read Postgres directly; route handlers host the agent runtime (Node runtime).
- **Claude Agent SDK 0.3** (`query()` + in-process MCP server) — one generic agent, ~22 small composable tools (`db_query` read-only SQL, `knowledge_*` filesystem, `generate_image/video`, `push_block`, `request_approval`, `send_email`, …). Workflows are mission prompts, not hard-coded pipelines.
- **Knowledge filesystem** — versioned markdown files in Supabase (`knowledge_files` + revisions). The agent reads the brand contract before every job and writes lessons back (`learnings/feedback-log.md`) — visible in the Knowledge page with "agent" badges.
- **Human-in-the-loop** — `request_approval` blocks the running agent on a Promise; the UI approval card (or Review page) resolves it via `POST /api/approvals/:id`. Emails and post publishing are hard-gated server-side.
- **Live streaming** — every run persists `agent_events` and broadcasts over SSE (`/api/runs/:id/stream`): streaming prose, tool timeline, charts, generated assets, approval cards, all replayable after refresh.
- **Supabase** — Postgres (20 tables), public `assets` storage bucket for generated media.
- **Gemini** — images (multi-ratio variants, editing, review annotation markup), Veo 3.1 Fast video with audio, `gemini-3.5-flash` for utility analysis.

## Running

```bash
pnpm install
# .env.local — see repo (Supabase, ANTHROPIC_API_KEY, GEMINI_API_KEY, DATABASE_URL)
pnpm tsx scripts/seed.ts   # reset + seed demo data (destructive)
pnpm dev                   # http://localhost:3000 → /studio
```

Optional real email: set `GMAIL_USER` + `GMAIL_APP_PASSWORD` (Google App Password) — otherwise approved emails park in the in-app Outbox.

Smoke tests: `pnpm tsx scripts/smoke-gemini.ts` (image+storage), `pnpm tsx scripts/smoke-agent.ts` (agent loop + tools).

## Demo data

`scripts/seed.ts` plants 14 days of believable chatter with discoverable narratives: a viral miso-caramel pavlova, recurring Friday-night service complaints at Surry Hills, an undercooked-chicken food-safety claim at Fitzroy (critical-flag path), staff praise for Em at Burleigh, vegan-menu demand, and a leaked winter truffle menu — plus a fresh unanalysed inbox so the first listening run has real work. `POST /api/ingest` drips in new items for live demos.
