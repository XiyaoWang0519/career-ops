# career-ops web (alpha)

An **experimental, opt-in web UI** for career-ops. It is a local-first *view* over
the exact same files the CLI reads and writes (`data/pipeline.md`,
`data/applications.md`, `reports/`, `config/`): no parallel engine, no separate
database. If you never run it, nothing about your CLI workflow changes.

> **Status: alpha.** Expect rough edges. Feedback →
> [Discussion #1142](https://github.com/santifer/career-ops/discussions/1142) ·
> roadmap context → [Discussion #156](https://github.com/santifer/career-ops/discussions/156).

## Quick start

Requires Node 20+.

```bash
cd web
npm ci
npm run dev
```

Open http://localhost:3000. The app reads the career-ops checkout it lives in
(the parent directory) — your existing CV, pipeline and reports appear as-is.

## What works today

- **Today / Pipeline / Follow-ups / Analytics / CV** — action queue, tracker,
  cadence, funnel, CV editing with preview.
- **Explore** — free reverse-ATS scan plus AI-assisted discovery.
- **Activity** — history of evaluations and other runs (persisted under
  `.career-ops-web/runs/`).
- **Apply** — assisted form prefill in a live browser embedded in the assistant
  chat. The agent can hand control to you for sign-in, MFA, CAPTCHA, or review,
  then resume. **It never submits for you**.
- **Config** — pick an AI tool (or pin one via env — see below).

## Friend-ready hosting (remote access)

Run the app on your machine; a friend opens it in their browser. Give them their
**own career-ops checkout** (their CV, tracker, reports) so data never mixes with
yours.

### Recommended exposure: Tailscale (or Cloudflare Tunnel)

Do **not** raw port-forward `3000` to the public internet. Prefer:

1. **[Tailscale](https://tailscale.com/)** — both devices on your tailnet; she
   opens `http://<your-magicdns>:3001` (or whatever port you chose). Transport is
   encrypted; no certs to manage.
2. **[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)** —
   same idea if you already use CF.

Then protect the UI with a password (see env below).

### Setup recipe — her dedicated checkout

```bash
# 1. Clone a fresh career-ops for her (separate from yours)
git clone https://github.com/santifer/career-ops.git career-ops-her
cd career-ops-her
# Drop her cv.md, fill config/profile.yml, modes/_profile.md, portals.yml
# (or walk through onboarding in the UI)

# 2. Web app env
cd web
cp .env.local.example .env.local   # or create fresh:
```

`web/.env.local`:

```bash
# Point at HER checkout (absolute path)
CAREER_OPS_ROOT=/absolute/path/to/career-ops-her

# Pin Codex so she never picks an "agent CLI"
CAREER_OPS_DEFAULT_CLI=codex

# Trim the sidebar for a non-technical user
CAREER_OPS_SIMPLE=1

# Run the host browser headlessly and stream it into assistant chat
CAREER_OPS_BROWSER_HEADLESS=1

# Password gate (required for any non-localhost exposure)
WEB_AUTH_PASSWORD=choose-a-strong-password
WEB_AUTH_SECRET=long-random-string

# Optional: dedicated port so it doesn't collide with your own instance
PORT=3001
```

```bash
# 3. Start (production-ish)
npm ci
npm run build
npm run start -- -p 3001
# or: npm run dev -- -p 3001
```

She signs in once (cookie lasts ~30 days), pastes a job URL, and evaluations
stream through Codex into **her** `reports/` + tracker.

### Remote Apply browser

Set `CAREER_OPS_BROWSER_HEADLESS=1` on a server or VM. Apply launches a browser
on that host and streams it into the assistant chat. Use **Take control** to
click, type, paste credentials, complete MFA/CAPTCHA, or review the form without
putting secrets into chat; use **Continue agent** to hand the same browser back.
Only the human presses the final Submit/Send/Apply control.

This requires a long-running Node process, an in-memory browser session, and a
Chrome/Chromium process. Deploy it to a VM or persistent container, not a
serverless Vercel Function.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `CAREER_OPS_ROOT` | Absolute path to the career-ops checkout to read/write |
| `CAREER_OPS_DEFAULT_CLI` | Pin the AI tool (`codex`, `claude`, …); hides the picker |
| `CAREER_OPS_SIMPLE` | `1` — sidebar: Today · Explore · Pipeline · Follow-ups · Activity · Analytics · CV |
| `CAREER_OPS_BROWSER_HEADLESS` | `1` — run the host browser headlessly and stream it into chat (recommended on a VM) |
| `WEB_AUTH_PASSWORD` | Enable password login (off when unset — local zero-config) |
| `WEB_AUTH_SECRET` | HMAC secret for the session cookie (falls back to a password-derived value) |
| `PORT` | `next start` / `next dev` listen port |

## Safety

- **Local-first:** your CV and data stay in your own files.
- **Auth when exposed:** set `WEB_AUTH_PASSWORD` before sharing a URL.
- **Never auto-submits:** the apply flow drafts and prefills; submitting is
  always a human action.
- **Additive:** the web is isolated from the core's packaging, CI and release
  automation. The CLI works exactly the same without it.

## Development

```bash
npm run dev          # dev server (Turbopack)
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm test             # node:test suite
```

For a credential-free handoff check in development, ask the assistant to apply
to `http://localhost:3000/api/browser-test`. The fixture exercises fake sign-in,
agent resume, form control, and user-only submission; it returns 404 in a normal
production build.
