# Search snapshots come from SerpAPI

DataForSEO was the first provider, and its account check blocked local searches. SerpAPI replaces it for the industry leaders finder because each Google search is one paid call with a published price, instead of DataForSEO's queue, postback, and reconcile flow.

SerpAPI's Google Search engine is called with location Hong Kong, `gl=hk`, and `device=mobile`. When the response includes an AI Overview `page_token`, that overview is fetched immediately; the token expires in about a minute. SerpAPI documents that the AI Overview block is currently seen for English searches (`hl=en`) and a limited set of countries. Chinese recommendation queries may return organic results without an AI Overview. Ranking still uses whatever signals are present.

The running app still calls DataForSEO until the provider switch is implemented.
