# MVP scope — Hong Kong Industry Leaders Finder

This file overrides [PLANNING.md](./PLANNING.md) where they conflict. PLANNING.md describes the later brand-diagnosis product; the MVP is narrower.

## What the MVP does

A visitor enters an **industry keyword** (e.g. `會計師`, `牙醫`, `accounting firm`). The app finds which businesses Google Hong Kong surfaces as the **market leaders** for that industry and shows a ranked list.

- No brand, website, or email input.
- Free results. No Stripe, PDF, Resend, Turnstile, or admin page in the MVP.
- UI in **Traditional Chinese (Hong Kong)** and **English**, switchable. Default `zh-HK`.

## Pipeline

1. Generate 6–8 HK recommendation queries from the keyword (templates in PLANNING.md → Query generation, minus the `{brand}` query).
2. DataForSEO Google Organic **Standard** `task_post` per query: `location_code` 2344 (confirm via locations endpoint), `language_code` `zh-TW`, `device` `mobile`, `load_async_ai_overview: true`, `tag` = search/query id, `postback_url` → `/api/dataforseo/postback`. Fallback: `task_get/advanced/{id}` via a reconcile route. Sandbox first.
3. Parse each SERP: AI Overview present?, AIO text, AIO `references[]` domains, organic results (rank, domain, title).
4. Rank leaders: aggregate by domain/business across all queries. Signals: AIO text mention, AIO citation, organic rank (top 10). Rule-based scoring, no LLM.
5. Show results page: ranked leaders with score, which queries they appeared in, AIO mention/citation counts, best organic rank. Exclude third-party aggregators (Wikipedia, OpenRice, price.com, news, directories) from the leader list but show them separately as "frequently cited sources".

## Pages and routes

- `/[locale]` — landing + keyword form
- `/[locale]/search/[token]` — `processing` → `ready` | `failed`
- `POST /api/searches` — create search, generate queries, post tasks
- `GET /api/searches/[token]` — status + results DTO
- `POST /api/dataforseo/postback`
- `GET /api/cron/reconcile`

## Data model (minimal)

- `searches`: keyword, locale, status (`queued|running|ready|failed`), `token`, timestamps
- `search_queries`: search_id, query text, dataforseo_task_id, status
- `serp_snapshots`: query_id, raw JSON, parsed JSON
- `results`: search_id, `leaders_json`

## Every results page shows the disclaimer

Google AI Overviews has no official API; DataForSEO is an unofficial scrape; results may differ from what a given HK user sees; snapshot only, not ChatGPT/Gemini.
