---
title: Local Development
---

Hacking on the app from a local checkout. For running GiftWrapt (self-hosted or on a managed platform) see [Get started](/overview/getting-started/).

## Requirements

- Node.js 22+
- pnpm 10+ (Corepack will pick up the version pinned in `package.json`)
- Docker (for local Postgres + S3-compatible storage)

## 1. Install Dependencies

```bash
pnpm install
```

## 2. Configure Environment

```bash
pnpm setup:env
```

Copies the checked-in templates to their local counterparts (if missing) and fills any placeholder secrets with cryptographically-random values. Idempotent — real values you've set are left alone. Targets:

- [`.env.local.example`](https://github.com/shawnphoffman/giftwrapt/blob/main/.env.local.example) → `.env.local` (regular dev)
- [`.env.local.screenshots.example`](https://github.com/shawnphoffman/giftwrapt/blob/main/.env.local.screenshots.example) → `.env.local.screenshots` (screenshot generator)

Pass `--force` to rotate every recognized secret, or `--print` to dry-run.

> Don't confuse [`.env.example`](https://github.com/shawnphoffman/giftwrapt/blob/main/.env.example) (in-cluster Docker hostnames, for self-host deploys) with `.env.local.example` (host-side `localhost`, for this workflow). `setup:env` only touches the local-dev templates.

Optional vars you might want to set by hand after `setup:env`:

- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` - enables transactional email; otherwise email features no-op.
- `CRON_SECRET` - only needed if you're poking at `/api/cron/*` endpoints locally.

## 3. Start Dependencies

The bundled compose file boots Postgres plus exactly one S3-compatible storage backend. Use the pnpm wrappers - they pass `--env-file .env.local` so the secrets you just generated reach the containers:

```bash
# Garage (default; admin-API bootstrap)
pnpm compose:up
pnpm storage:init

# OR RustFS (MinIO-compatible, simpler bootstrap)
pnpm compose:up:rustfs
pnpm storage:init:rustfs
```

Stick with one for the lifetime of the checkout - they share Postgres but bind different storage volumes.

> [!WARNING]
> Running `docker compose up` directly (without `--env-file .env.local`) reads `.env` by default, which doesn't exist in a local checkout. Docker Compose will substitute every `${VAR}` reference with an empty string, Garage will refuse the resulting blank credentials, and Postgres will boot but be unreachable to the app. Use the pnpm wrappers.

## 4. Run Migrations and Seed

The Postgres container auto-creates `giftwrapt_dev` (from `POSTGRES_DB`) on first boot, so migrations have a target the moment `compose:up` returns.

```bash
pnpm db:migrate
SEED_SAFE=1 pnpm db:seed   # optional, populates test users
```

> [!WARNING]
> `db:seed` truncates the database before inserting fixtures. It refuses to run unless `DATABASE_URL` points at a known-local host AND `SEED_SAFE=1` is set, but it absolutely will clobber your local data. See [local-dev-admin.md](/contributing/local-dev-admin/) for the seeded credentials.

## 5. Run the App

```bash
pnpm dev
```

App: <http://localhost:3001>

> The first request after a cold boot sometimes 500s with `routerEntry.getRouter is not a function` from TanStack Start. Refresh; subsequent requests succeed. It's a known dev-mode race in the route-tree generator, not a project bug.

## Two parallel stacks: dev + screenshots

`pnpm dev` and `pnpm dev:screenshots` run side by side without colliding. They share the same Postgres container (and Garage if configured) but use **separate databases** inside it:

| Stack                  | Port | Database                    | Env file                  |
| ---------------------- | ---- | --------------------------- | ------------------------- |
| `pnpm dev`             | 3001 | `giftwrapt_dev`             | `.env.local`              |
| `pnpm dev:screenshots` | 3003 | `giftwrapt_dev_screenshots` | `.env.local.screenshots`  |

`pnpm dev:screenshots` is end-to-end: it creates the screenshots DB if missing, applies migrations, loads screenshot-specific fixtures (overwriting any prior screenshot data), then boots Vite. Storage values in the screenshots env are intentionally fake; the boot probe is disabled via `STORAGE_SKIP_BOOT_CHECK=true`.

```bash
pnpm dev:screenshots       # boots on http://localhost:3003
pnpm screenshots           # capture against the running server
```

## Other Dev Servers

| Command          | Port | What                            |
| ---------------- | ---- | ------------------------------- |
| `pnpm storybook` | 6006 | Component explorer + a11y addon |
| `pnpm dev-email` | 3002 | React Email preview             |
| `pnpm db:studio` | 4983 | Drizzle Studio                  |

## Resetting

Two levels, depending on what you want to nuke:

```bash
# Reset the regular dev database (giftwrapt_dev). Keeps postgres + storage
# volumes intact. Drops the named DB, recreates it empty, migrates, reseeds.
# Local hosts only — the script's allowlist refuses non-local DATABASE_URLs.
pnpm db:reset

# Re-seed the screenshots database (giftwrapt_dev_screenshots).
# `dev:screenshots` always truncates and reseeds before booting Vite.
pnpm dev:screenshots

# Nuke everything: postgres volume, storage volume, network.
pnpm compose:down -v
```

After a full nuke, restart from step 3.

## Migrations workflow

Schema changes go through `pnpm db:generate` → committed migration → `pnpm db:migrate`. Never use `drizzle-kit push`; it's been removed from the project because it leaves the migration tracker empty and silently desynchronizes the schema from `__drizzle_migrations`. If you encounter a self-host deploy failing with "database has application tables but the drizzle migration tracker is empty or missing", the fix is `pnpm compose:down -v` (or the equivalent volume removal) followed by a clean start - the container's entrypoint preflight is doing its job by refusing to run migrations against a corrupted volume.

For the full workflow and the guardrails (`pnpm db:check`, `pnpm db:check-drift`, the pre-commit hook), see the in-repo notes alongside the migrations.

## Next Steps

- [Contributing](/contributing/contributing/) - scripts, conventions, PR workflow
- [Storage](/configuration/storage/) - swapping backends, env reference
- [Scraping](/configuration/scraping/) - URL scraping pipeline (browserless, AI extractors)
