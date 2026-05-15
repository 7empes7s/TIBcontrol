# TIB Control Surface

Operator dashboard for the TechInsiderBytes AI pipeline stack. A React + Bun SPA that provides real-time visibility and control across autopipeline, model management, NewsBites publishing, infrastructure, incidents, jobs, audit logs, agent builder, and live AI agent sessions (OpenCode, Codex, Claude Code, Gemini).

## Screenshots

Screenshots are organized under `screenshots/dark/` and `screenshots/light/`, each with `desktop--<page>.png` and `mobile--<page>.png` variants.

### Dark mode — desktop

| Home | Today | Autopipeline |
|------|-------|-------------|
| ![home](screenshots/dark/desktop--home.png) | ![today](screenshots/dark/desktop--today.png) | ![autopipeline](screenshots/dark/desktop--autopipeline.png) |

| NewsBites | Incidents | Models |
|-----------|-----------|--------|
| ![newsbites](screenshots/dark/desktop--newsbites.png) | ![incidents](screenshots/dark/desktop--incidents.png) | ![models](screenshots/dark/desktop--models.png) |

| Infra | Jobs | Audit |
|-------|------|-------|
| ![infra](screenshots/dark/desktop--infra.png) | ![jobs](screenshots/dark/desktop--jobs.png) | ![audit](screenshots/dark/desktop--audit.png) |

| Doctor | Builder | Settings |
|--------|---------|----------|
| ![doctor](screenshots/dark/desktop--doctor.png) | ![builder](screenshots/dark/desktop--builder.png) | ![settings](screenshots/dark/desktop--settings.png) |

| OpenCode | Codex | Claude Code | Gemini |
|----------|-------|-------------|--------|
| ![opencode](screenshots/dark/desktop--opencode.png) | ![codex](screenshots/dark/desktop--codex.png) | ![claude](screenshots/dark/desktop--claude.png) | ![gemini](screenshots/dark/desktop--gemini.png) |

### Light mode — desktop

| Home | NewsBites | Incidents |
|------|-----------|-----------|
| ![home](screenshots/light/desktop--home.png) | ![newsbites](screenshots/light/desktop--newsbites.png) | ![incidents](screenshots/light/desktop--incidents.png) |

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — live stack health summary, SSE-streamed service statuses, GPU, pipeline queue |
| `/today` | Today — daily publishing stats, what ran today |
| `/autopipeline` | Pipeline queue, approvals, stage durations, pause/resume/inject controls |
| `/newsbites` | Article management, publish stats, 30-day chart, deploy trigger |
| `/models` | LiteLLM model registry, block/unblock controls, rate limits |
| `/infra` | Server and service health across all hosts |
| `/incidents` | 7-day error heatmap, incident timeline with evidence drawer |
| `/jobs` | Background job monitor with status and logs |
| `/audit` | Operator action audit log |
| `/doctor` | Pipeline doctor reports and abandoned story analysis |
| `/builder` | Workflow builder — create, schedule, and monitor multi-step agent workflows |
| `/settings` | Stack configuration and preferences |
| `/opencode` | Live OpenCode agent session (SSE streaming) |
| `/codex` | Live Codex agent session |
| `/claude` | Live Claude Code agent session |
| `/gemini` | Live Gemini agent session |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, wouter (client-side routing) |
| Server | Bun, custom HTTP router |
| Styling | CSS custom properties, dark/light themes via `data-theme` |
| Charts | Recharts |
| Icons | Lucide React |
| Real-time | SSE (`/api/stream`) for home, per-session streams for agent pages |

---

## Quick Start

### Prerequisites

- Bun 1.3+
- `OPERATOR_TOKEN` environment variable set

### Development

```bash
bun install
bun run dev        # Vite dev server on :5173
```

### Production

```bash
bun run build      # builds to dist/
bun run start      # Bun server on :3000
```

### Environment variables

```
PORT=3000
OPERATOR_TOKEN=<your-secret>
NODE_ENV=production
```

### systemd

```ini
[Service]
ExecStart=/root/.bun/bin/bun run server/index.ts
Environment=OPERATOR_TOKEN=<your-secret>
Environment=PORT=3000
Environment=NODE_ENV=production
```

---

## Authentication

The dashboard uses HMAC-signed session cookies. POST `/api/auth/session` with `{ "token": "<OPERATOR_TOKEN>" }` to establish a session. Protected endpoints return 401 without a valid cookie; the `authFetch` helper in `app/lib/authFetch.ts` prompts for the token and retries automatically.

Public endpoints (home stream, newsbites feed, incidents feed) are unauthenticated.

---

## Project Structure

```
├── app/
│   ├── components/        # Shared UI (SectionCard, TablePageControls, AgentComposer, …)
│   ├── hooks/             # useApi, useStream, useTablePage, useAction, …
│   ├── lib/               # authFetch, store
│   └── routes/            # One file per page
├── server/
│   ├── api/               # Route handlers + types
│   ├── adapters/          # External service adapters (doctor, models, …)
│   ├── builder/           # Workflow builder engine
│   └── db/                # Data layer (dashboard, ingestor, sampler, …)
├── screenshots/
│   ├── dark/              # Dark theme — desktop + mobile
│   └── light/             # Light theme — desktop + mobile
├── index.html
├── vite.config.ts
└── package.json
```

---

## Theming

Theme is controlled by `data-theme="dark|light"` on `<html>` and persisted to `localStorage` under the key `tib-theme`. Toggle buttons are in the top nav. Default is `dark`.

---

## License

MIT
