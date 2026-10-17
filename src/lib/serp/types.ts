/**
 * Vendor-agnostic SERP intake boundary.
 *
 * DataForSEO (`src/lib/dataforseo/parse.ts`) and SerpAPI (`src/lib/serpapi/parse.ts`)
 * both produce `ParsedSerp` snapshots. Ranking, referrer heuristics, and LLM
 * operator classification consume this shape and do not depend on a SERP vendor.
 */
export type { ParsedSerp, AioReference, OrganicResult } from "@/lib/types";
