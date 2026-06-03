# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Scoutradioz is a multi-app FRC scouting platform deployed as several independent AWS Lambda / SST stacks plus shared in-repo packages. There is no top-level monorepo tool — each sub-project has its own `package.json`, `node_modules`, and `yarn.lock`, and the shared packages are linked through `file:../<pkg>/` paths.

Apps (each independently deployable):
- `primary/` — Express + Pug Lambda behind SST. Serves `scoutradioz.com` and most authenticated user flows (scouting, reports, manage, admin). Entry: `src/app.ts` → `src/lambda.ts` (deployed) / `src/www.ts` (local). Routes live in `src/routes/{admin,manage}` and top-level route files. View templates in `views/` (Pug). Static client code is in `public-src/` and compiled into `public/`.
- `voyager/` — SvelteKit PWA (separate SST stack). Has its own `databases.json`, hooks (`src/hooks.server.ts`), and routes under `src/routes/`. Uses Lucia for auth and Dexie for offline storage.
- `upload/` — Lambda for S3 photo uploads and dynamic match-notification header image generation (uses `jimp`).
- `webhook/` — Lambda subscribed to The Blue Alliance Firehose; emits push notifications to assigned scouters.
- `scheduler/` — Lambda triggered on schedule (CloudFormation-managed, not SST).

Shared packages (linked via `file:`, not published to NPM anymore):
- `scoutradioz-utilities/` — `utilities` singleton: MongoDB wrapper with caching, tier-aware DB URL resolution, auto-incrementing IDs. Configured once in each app's entry point.
- `scoutradioz-helpers/` — `matchData`, `upload`, `derived` helpers; configured by passing the already-configured `utilities` instance via `configHelpers(utilities)`.
- `scoutradioz-types/` — Ambient `.d.ts` declarations for all DB document shapes (`MatchScouting`, `Event`, `Org`, etc.). Imported as `scoutradioz-types`.
- `scoutradioz-http-errors/` — Tiny dependency-free HTTP error classes plus an `assert` helper used in Express routes.
- `scoutradioz-eslint/` — Custom ESLint rule (`scoutradioz-eslint/res-render-require-title`) enforcing a `title` on every `res.render`.

## Common commands

Top-level (`/workspaces/scoutradioz/`):
- `yarn setup` — first-time install across root, shared packages, primary, public-src, upload, webhook, voyager (with `--ignore-platform --ignore-engines` for voyager).
- `yarn dev` (or `yarn start`) — runs `scripts/dev.js` which spawns `mongod`, primary (nodemon on `src/www.ts`), upload, the static TS watcher, and the LESS/Svelte watchers in one process. Type `rs` to restart Express children.
- `yarn update` — refresh deps across all packages and rebuild shared packages.
- `yarn lint` — runs the ESLint command, but it only targets `primary/app.js`; for broader linting run ESLint per-package.

Primary (`primary/`):
- `yarn start` — `nodemon` on `src/www.ts` (loads `.env.dev`). Usually started via root `yarn dev` instead.
- `yarn compile-static` — chains `compile-less`, `compile-ts`, `compile-svelte` (Bun executes `scripts/compilePrimarySvelte.ts`).
- `yarn compile-less` / `yarn compile-ts` / `yarn compile-svelte` — individual static builds.
- `yarn theme` — recompile SMUI theme into `public/css/smui.css`.
- `yarn deploy-test` / `yarn deploy-qa` / `yarn deploy-prod` — `sst deploy --stage <stage>` with `HASH=$(git rev-parse HEAD)`. QA/prod refuse to deploy with a dirty working tree (`check-working-tree-clean`). Always deploy to `test` first, then promote.

Voyager (`voyager/`):
- `yarn dev` — `vite dev --host`.
- `yarn check` — `svelte-kit sync && svelte-check`.
- `yarn lint` / `yarn format` — Prettier + ESLint.
- `yarn deploy-test|qa|prod` — SST v2 deploy. Install with `--ignore-engines` until upgraded to SST v3.

## Architecture details that span files

**Tier-aware DB selection.** `process.env.TIER` (set per Lambda alias / stage) selects an entry from `databases.json`, with a `default` fallback. `utilities.config(require('../databases.json'), {...})` must run before anything that touches the DB; `utilities.refreshTier` is the very first middleware in `primary/src/app.ts`. The same pattern applies in `voyager/src/hooks.server.ts`. `scripts/dev.js` defaults `TIER=dev`, which resolves to a local mongod at `127.0.0.1:27017`.

**Caching wrapper.** All DB reads go through `utilities` (`find`, `findOne`, `distinct`, `aggregate`). Passing `{allowCache: true}` enables the 30s cache configured in `app.ts`. Don't hit the `mongodb` driver directly when a utilities method exists — caching, ID coercion (`schemasWithNumberIds`), and tier-aware connections are handled there.

**Auth + permissions.** `passport` + `express-session` (with `@firstteam102/connect-mongo` storing sessions in Mongo). `usefunctions.authenticate` attaches `req.authenticate(level)` to every request; route handlers gate with `await req.authenticate(Permissions.ACCESS_VIEWER|SCOUTER|TEAM_ADMIN|GLOBAL_ADMIN)` defined in `src/helpers/permissions.ts`. Auth0 is wired via `express-openid-connect` for an alternative login path.

**View pipeline (primary).** Pug templates in `views/` are rendered server-side. `usefunctions.setViewVariables` is the last middleware before routes — view locals depend on it. The custom ESLint rule requires every `res.render(view, {...})` call to include a `title:` field.

**Static asset pipeline (primary).** Three independent compilers feed `public/`:
- LESS sources in `public-src/less/` → `public/css/style.css` (compileLess.js)
- TypeScript in `public-src/ts/` (per-file scripts) and `public-src/ts-bundled/` (bundled into `bundle.js`) → `public/js/`
- Svelte components in `public-src/svelte/` → bundled by `scripts/compilePrimarySvelte.ts` (esbuild + esbuild-svelte) and embedded via the `svelte.pug` view.

In `sst dev`, the lambda copies `views/`, `locales/`, and `public/` into the function bundle; in deployed stages, `public/` is served from a separate `StaticSite` behind the SST `Router`, so changes to `public/` after deploy require a redeploy.

**Internationalization.** `src/helpers/i18n.ts` is a custom I18n implementation; locale JSON files live in `primary/locales/` (and `voyager/`'s equivalent). Add new strings there; views use `msg('key')`. Translations are managed on Weblate.

**Sync route bypasses auth.** `app.use('/admin/sync', sync)` is mounted *before* the authentication middleware so cron / webhook callers can hit it unauthenticated. Don't reorder.

**SST stages.** Valid stages are `dev` (local SST dev), `test`, `qa`, `prod`. `prod` is protected (`removal: 'retain'`, `protect: true`). Stages other than `dev` require a clean working tree and a git hash.

## Code style (from `.eslintrc.yml`)

- Tabs for indentation, single quotes, semicolons required, Stroustrup brace style.
- `@typescript-eslint/consistent-type-imports` is enforced as a warning — use `import type { ... }` for type-only imports.
- `@typescript-eslint/no-explicit-any` is off; `any` is allowed when needed.
- `bundle.d.ts` is ignored by ESLint.
