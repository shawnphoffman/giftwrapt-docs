---
title: Contributing
---

Thanks for your interest. GiftWrapt is a personal project, but contributions are welcome. This page covers the dev workflow once your local stack is up. For first-time setup see [Local development](/contributing/local-development/).

## Project Layout

```
src/
  routes/        TanStack Router file-based routes
  components/    UI components (shadcn-derived in components/ui)
  db/            Drizzle schema and queries
  lib/           Server-side helpers (auth, storage, scraping, email)
  emails/        React Email templates
  api/           Server-only utilities and integrations
drizzle/         Generated SQL migrations (committed)
docker/          Self-host compose files and runtime scripts
scripts/         CLI entry points (admin, seed, storage init)
```

## Setup

| Command                  | What it does                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm setup:env`         | Copy `.env.local.example` to `.env.local` and fill in placeholder secrets with cryptographically-random values. Idempotent; real values left alone. Pass `--force` to rotate everything. |
| `pnpm compose:up`        | Start the local Postgres + Garage stack via `docker compose --env-file .env.local --profile garage up -d`.                                                                                |
| `pnpm compose:up:rustfs` | Same as above with the RustFS profile instead of Garage.                                                                                                                                  |
| `pnpm compose:down`      | Stop the stack. Add ` -v` to nuke volumes (destructive).                                                                                                                                  |
| `pnpm compose:logs`      | Tail the stack's logs.                                                                                                                                                                    |

## Scripts

| Command                 | What it does                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm dev`              | Run migrations and start the dev server on `:3001` against `giftwrapt_dev`.                 |
| `pnpm dev:screenshots`  | Create + migrate + seed `giftwrapt_dev_screenshots` and start vite on `:3003` (parallel to `dev`). |
| `pnpm screenshots`      | Run Playwright against the screenshots dev server.                                          |
| `pnpm build`            | Production build (Nitro server + standalone CLI bundles).                                   |
| `pnpm test`             | Unit and Storybook tests via Vitest.                                                        |
| `pnpm test:integration` | Integration tests (pglite, applies migrations cold).                                        |
| `pnpm test:all`         | Everything.                                                                                 |
| `pnpm lint`             | ESLint over the whole tree.                                                                 |
| `pnpm format`           | Prettier check.                                                                             |
| `pnpm check`            | Format and autofix lint. Run before committing.                                             |
| `pnpm storybook`        | Storybook on `:6006`.                                                                       |
| `pnpm dev-email`        | React Email preview server on `:3002`.                                                      |

## Database

| Command               | What it does                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:generate`    | Generate a SQL migration from schema changes. **Commit the output (SQL + journal + snapshot).**                                                                                                                                             |
| `pnpm db:migrate`     | Apply pending migrations.                                                                                                                                                                                                                   |
| `pnpm db:check`       | Validate `drizzle/meta/_journal.json` invariants (monotonic `when` by `idx`). Auto-runs in pre-commit when `drizzle/**` is staged, and in CI.                                                                                               |
| `pnpm db:check-drift` | Runs `db:generate` and asserts the working tree stays clean. Catches "edited `src/db/schema/**` without generating a migration." Runs in CI.                                                                                                |
| `pnpm db:reset`       | Drop + recreate the local DB, migrate, and reseed. Local-host allowlist refuses anything else.                                                                                                                                              |
| `pnpm db:studio`      | Drizzle Studio.                                                                                                                                                                                                                             |
| `pnpm db:seed`        | Seed local DB with test users and data. Requires `SEED_SAFE=1`. **Truncates everything.**                                                                                                                                                   |

There is no `db:push`. Schema changes go through `db:generate` + `db:migrate` only - push and migrate can't share a database without desynchronizing the migration tracker (see [local-development.md § Migrations workflow](/contributing/local-development/#migrations-workflow)).

The local seeded admin and other test users are documented in [local-dev-admin.md](/contributing/local-dev-admin/).

## Storybook

Component stories live next to their components (`*.stories.tsx`). Storybook runs as a Vitest project so stories are typechecked and smoke-tested on every `pnpm test`. New UI work should ship with a story for the interesting states.

## Conventions

### TypeScript and React

- React 19, React Compiler is enabled. Don't reach for `useMemo` or `useCallback` reflexively; profile first.
- Server functions and loaders live next to their routes. Pure data helpers go in `src/lib/` or `src/db/queries/`.
- Prefer Drizzle's relational query API over hand-rolled SQL where it fits.

### shadcn Components

Components in `src/components/ui/` are owned by this repo, not pulled from a package. When you pull an upstream shadcn improvement, diff it against the local file rather than overwriting: several of these carry local customizations.

### Styling

Tailwind CSS v4. Follow the existing `cn()` + `class-variance-authority` patterns in `src/components/ui/`.

### Commits

Conventional Commits, imperative mood, ≤72 chars on the subject:

```
feat(lists): add bulk archive action
fix(scraping): fall back to og:image when product image is missing
docs(self-host): document RustFS bootstrap
```

Pre-commit hooks run `lint-staged` (Prettier + ESLint on staged files). Commitlint enforces the format.

### Releases

`release-please` watches `main` and opens a PR with the next version bump and `CHANGELOG.md` entry derived from commit messages. Merging that PR tags a release and triggers the GHCR image publish (`ghcr.io/shawnphoffman/giftwrapt:vX.Y.Z` plus `:latest`).

## Security Model: CSRF and Server Functions

State-changing TanStack server functions and route handlers should always use `method: 'POST'`. The CSRF posture for those calls relies entirely on the auth cookie's `SameSite=Lax` attribute (better-auth default, set in `src/lib/auth.ts`):

- **Lax** prevents the auth cookie from being attached to cross-origin `POST` requests. An attacker page on `evil.example` can render a form that posts to our server function, but the browser strips the cookie, the auth middleware sees no session, and the call is refused.
- **Top-level navigation `GET`s do carry the Lax cookie**, but state changes are POST-only, so a malicious link can't trigger one. Reads (`method: 'GET'` server fns) are CSRF-irrelevant by definition; they don't change state.
- **Same-site XSS would defeat this** (along with any explicit CSRF token), so the `Content-Security-Policy` headers in `vite.config.ts` and the existing input-validation pattern (every server fn uses `.inputValidator()` with zod) are the actual XSS defense.

Concretely, when adding a new server function or route:

- Use `createServerFn({ method: 'POST' })` for anything that writes. Never accept writes via `GET`.
- Don't enable `crossSubDomainCookies` on better-auth without re-evaluating this posture; sharing the cookie across subdomains widens the trust boundary.
- Don't set your own cookies bypassing better-auth's cookie helpers. If you need one, ensure `httpOnly: true`, `sameSite: 'lax'` (or `'strict'`), `secure` on HTTPS.

See sec-review L6.

## Pull Requests

1. Branch from `main`.
2. Run `pnpm check` and `pnpm test` before opening the PR. CI additionally runs `pnpm test:integration`, `pnpm db:check`, `pnpm db:check-drift`, `pnpm build-storybook`, and a production build, so running those locally too saves a round trip.
3. If you touched the schema, commit the generated migration in `drizzle/`.
4. If you touched UI, add or update a Storybook story.
5. Note any new env vars in `.env.example` and the relevant doc.

## Where to Find Things

- App overview and quick start: [README](https://github.com/shawnphoffman/giftwrapt/blob/main/README.md)
- Local dev: [local-development.md](/contributing/local-development/)
- Self-hosting with Docker: [self-hosting.md](/deploy/self-hosting/)
- Storage backends: [storage.md](/configuration/storage/)
- URL scraping pipeline: [scraping.md](/configuration/scraping/)
- Local dev admin / seeded users: [local-dev-admin.md](/contributing/local-dev-admin/)
