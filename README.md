# Hong Kong Industry Leaders Finder

Enter an industry keyword (e.g. `會計師`, `牙醫`, `accounting firm`) and see which businesses Google Hong Kong surfaces as market leaders, based on DataForSEO SERP + AI Overview data.

Scope and product rules: [docs/MVP.md](docs/MVP.md) (overrides [docs/PLANNING.md](docs/PLANNING.md)). DataForSEO JSON details: [docs/POC.md](docs/POC.md).

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript (strict) + Tailwind CSS 4 + ESLint
- [next-intl](https://next-intl.dev) — locales `zh-HK` (default) and `en`, routes under `src/app/[locale]`
- Postgres + [Drizzle ORM](https://orm.drizzle.team) (`drizzle-kit` migrations)
- Vitest

## Setup

Requires Node 20+ (tested on 24), pnpm, and Docker (for local Postgres).

```bash
pnpm install
cp .env.example .env.local       # then fill in DataForSEO credentials
docker compose up -d postgres    # Postgres on localhost:5432, db hk_leaders
pnpm db:migrate                  # apply migrations in drizzle/
pnpm dev                         # http://localhost:3000 -> redirects to /zh-HK
```

Verify DataForSEO credentials (calls `/appendix/user_data`, sandbox by default):

```bash
pnpm dataforseo:ping
```

If `task_post` returns status `40104` (“Please verify your account”), complete verification in the [DataForSEO user panel](https://app.dataforseo.com/) — `user_data` can succeed while SERP endpoints stay blocked.

## Local end-to-end run (sandbox)

DataForSEO postbacks cannot reach `localhost`, so local runs pull finished tasks via the reconcile route instead of waiting for `/api/dataforseo/postback`.

1. **Env** — in `.env.local` set sandbox credentials and secrets. Recommended for local:

   ```bash
   DATAFORSEO_BASE_URL=https://sandbox.dataforseo.com/v3
   APP_URL=http://localhost:3000
   RECONCILE_MIN_AGE_MS=0          # skip the default 2-minute postback grace period
   ```

   Keep `POSTBACK_SECRET` and `CRON_SECRET` set (any non-empty values for local).

2. **Postgres** — `docker compose up -d postgres` then `pnpm db:migrate`.

3. **Dev server** — `pnpm dev` (http://localhost:3000 → `/zh-HK`).

4. **Submit a search** — on `/zh-HK` (or `/en`) enter a keyword (e.g. `會計師`) and submit. You land on `/[locale]/search/[token]` in `queued` / `running`.

5. **Reconcile** — poll until tasks complete (sandbox is usually seconds). From another terminal:

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reconcile
   ```

   Repeat until the JSON shows `pending: 0` and `ready` (or `failed`) counts, then check status:

   ```bash
   curl -s http://localhost:3000/api/searches/<token>
   ```

   Expect `"status":"ready"` with a non-empty `leaders` array (sandbox fixtures vary; organic domains still rank).

6. **UI** — refresh `/zh-HK/search/<token>` and `/en/search/<token>`; both should render the leaders table, cited sources, and query list.

Optional: without a real search, open `/zh-HK/search/mock?mock=ready` in development to preview the results UI.

## Environment variables

See [.env.example](.env.example). Never commit `.env.local`.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | DataForSEO Basic auth |
| `DATAFORSEO_BASE_URL` | Defaults to sandbox `https://sandbox.dataforseo.com/v3`; production is `https://api.dataforseo.com/v3` |
| `POSTBACK_SECRET` | Shared secret for `POST /api/dataforseo/postback` |
| `APP_URL` | Public base URL, used to build postback URLs |
| `CRON_SECRET` | Bearer secret for `GET /api/cron/reconcile` |
| `RECONCILE_MIN_AGE_MS` | Optional; default `120000`. Set `0` locally so reconcile can pull immediately |

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (run once) |
| `pnpm db:generate` | Generate a SQL migration from `src/lib/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm dataforseo:ping` | Check DataForSEO credentials |

## Layout

```
messages/{zh-HK,en}.json      UI strings
drizzle/                      generated SQL migrations
scripts/dataforseo-ping.ts    credential check
src/proxy.ts                  next-intl locale routing (Next 16 "proxy" = middleware)
src/i18n/                     routing, request config, locale-aware navigation
src/app/[locale]/             pages: landing, search/[token]
src/app/api/                  searches, DataForSEO postback, reconcile cron
src/components/               keyword form, search results UI
src/lib/types.ts              shared types (ParsedSerp, Leader, SearchResultDTO, ...)
src/lib/db/                   Drizzle schema + lazy client (getDb)
src/lib/queries/              HK recommendation query generation
src/lib/dataforseo/           client, task_post/get, SERP parse, ingest + finalize
src/lib/ranking/              computeLeaders + aggregator exclusion
```

## Notes

- `next.config.ts` sets the `next-intl/config` Turbopack alias directly instead of using `createNextIntlPlugin`: the plugin eagerly loads `@swc/core`, whose native binding fails to load on some Windows machines.
- `cacheComponents` is off, so pages render dynamically by default without needing Suspense boundaries around data access.
- `src/lib/db` and `src/lib/dataforseo` import `server-only`; scripts that use them must run with `tsx --conditions=react-server`.
- Production should expose a public `APP_URL` so DataForSEO postbacks hit `/api/dataforseo/postback`; keep reconcile as a fallback cron.
