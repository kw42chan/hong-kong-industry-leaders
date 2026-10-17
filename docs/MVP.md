# MVP scope — Hong Kong Industry Leaders Finder

This file overrides [PLANNING.md](./PLANNING.md) where they conflict. PLANNING.md describes the later brand-diagnosis product; the MVP is narrower.

## What the MVP does

A visitor enters an **industry keyword** (e.g. `會計師`, `牙醫`, `accounting firm`). The app finds which businesses Google Hong Kong surfaces as the **market leaders** for that industry and shows a ranked list.

- No brand, website, or email input.
- Free results. No Stripe, PDF, Resend, Turnstile, or admin page in the MVP.
- UI in **Traditional Chinese (Hong Kong)** and **English**, switchable. Default `zh-HK`.

## Pipeline

The search provider is **SerpAPI**. See [ADR 0002](./adr/0002-serpapi-instead-of-dataforseo.md). The code may still call DataForSEO until that switch is built.

1. Generate 6–8 HK recommendation queries from the keyword (templates in PLANNING.md → Query generation, minus the `{brand}` query).
2. For each query, call SerpAPI Google Search (`engine=google`): `location=Hong Kong`, `gl=hk`, `device=mobile`, and `google_domain=google.com.hk`. Use `hl=zh-tw` for a Chinese query and `hl=en` for an English query. The API key stays server-side. There is no postback and no reconcile cron.
3. If `ai_overview.page_token` is present, immediately call SerpAPI `engine=google_ai_overview` with that token. The token expires in about a minute. SerpAPI currently documents AI Overviews for English searches (`hl=en`) and a limited set of countries, so a Chinese query may have organic results and no AI Overview.
4. Parse each SERP: AI Overview present?, AI Overview text, AI Overview reference domains, organic results (rank, domain, title) in the top 10.
5. Rank leaders: aggregate by domain/business across all queries. Signals: AI Overview text mention, AI Overview citation, organic rank (top 10). Rule-based scoring, no LLM. A missing AI Overview does not fail the search.
6. Show results page: ranked leaders with score, which queries they appeared in, AI Overview mention/citation counts, best organic rank. Exclude third-party aggregators (Wikipedia, OpenRice, price.com, news, directories) from the leader list but show them separately as "frequently cited sources".

## Pages and routes

- `/[locale]` — landing + keyword form
- `/[locale]/search/[token]` — `processing` → `ready` | `failed`
- `POST /api/searches` — create search, generate queries, fetch SerpAPI results
- `GET /api/searches/[token]` — status + results DTO

## Data model (minimal)

- `searches`: keyword, locale, status (`queued|running|ready|failed`), `token`, timestamps
- `search_queries`: search_id, query text, provider search id, status
- `serp_snapshots`: query_id, raw JSON, parsed JSON
- `results`: search_id, `leaders_json`

## Every results page shows the disclaimer

Google AI Overviews has no official API; SerpAPI is an unofficial scrape; results may differ from what a given HK user sees; a Chinese query may have no AI Overview; snapshot only, not ChatGPT/Gemini.
