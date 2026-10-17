/**
 * Vendor-agnostic SERP intake boundary.
 *
 * DataForSEO (`src/lib/dataforseo/parse.ts`) and future SerpAPI adapters should
 * produce `ParsedSerp` snapshots only. Ranking, referrer heuristics, and LLM
 * operator classification consume this shape and do not depend on a SERP vendor.
 */
export type { ParsedSerp, AioReference, OrganicResult } from "@/lib/types";
