/** When true, survivors of referrer heuristics are enriched and batch-classified by LLM. */
export function isOperatorFilterEnabled(): boolean {
  const raw = process.env.OPERATOR_FILTER_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Minimum confidence for `uncertain` labels to remain in leaders (default: exclude uncertain). */
export function uncertainOperatorMinConfidence(): number {
  const raw = process.env.OPERATOR_FILTER_UNCERTAIN_MIN_CONFIDENCE?.trim();
  if (!raw) return 1; // never promote uncertain unless explicitly configured
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

export function llmApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || undefined;
}

export function llmBaseUrl(): string {
  const custom = process.env.LLM_BASE_URL?.trim();
  if (custom) return custom.replace(/\/$/, "");
  if (process.env.OPENROUTER_API_KEY?.trim()) return "https://openrouter.ai/api/v1";
  return "https://api.openai.com/v1";
}

export function llmModel(): string {
  return (
    process.env.LLM_MODEL?.trim() ||
    "openai/gpt-4o-mini" // cheap default on OpenRouter; override via env
  );
}

export function enrichmentEnabled(): boolean {
  const raw = process.env.OPERATOR_FILTER_ENRICH?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return isOperatorFilterEnabled();
}

export const ENRICH_TIMEOUT_MS = 8000;
export const ENRICH_MAX_BYTES = 512_000;
