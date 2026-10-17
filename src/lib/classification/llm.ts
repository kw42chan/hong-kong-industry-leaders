import { llmApiKey, llmBaseUrl, llmModel } from "./config";
import type { DomainEnrichmentSignals, OperatorClassification } from "./types";

export class LlmConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigurationError";
  }
}

function compactSignals(s: DomainEnrichmentSignals): Record<string, unknown> {
  return {
    domain: s.domain,
    serpTitle: s.pageTitle,
    homepageUrl: s.homepageUrl,
    metaDescription: s.metaDescription,
    h1: s.h1,
    organizationName: s.organizationName,
    organizationTypes: s.organizationTypes,
    contactHints: s.contactHints,
    aboutSnippet: s.aboutSnippet?.slice(0, 800) ?? null,
    fetchErrors: s.fetchErrors,
  };
}

export async function classifyDomainsBatch(
  industryKeyword: string,
  signals: DomainEnrichmentSignals[],
): Promise<OperatorClassification[]> {
  const apiKey = llmApiKey();
  if (!apiKey) {
    throw new LlmConfigurationError(
      "OPERATOR_FILTER_ENABLED requires OPENROUTER_API_KEY or OPENAI_API_KEY",
    );
  }
  if (!signals.length) return [];

  const system = `You classify websites for an industry keyword search in Hong Kong.
For each domain, decide whether the site OPERATES in that industry (sells or delivers the service/product)
or is a REFERRER (directory, listicle, news, comparison, blog, or media that only lists or writes about others).
Respond with JSON only: { "classifications": [ { "domain", "label": "operator"|"referrer"|"uncertain", "companyName"?, "confidence": 0-1, "reasons": string[] } ] }.
Be conservative: marketing agencies, review sites, and "best/top N" list publishers are referrers.`;

  const user = JSON.stringify(
    {
      industryKeyword,
      instruction:
        "Does each site sell/practice the industry service, or only list/write about others?",
      sites: signals.map(compactSignals),
    },
    null,
    2,
  );

  const res = await fetch(`${llmBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.OPENROUTER_API_KEY
        ? {
            "HTTP-Referer": process.env.APP_URL ?? "https://localhost",
            "X-Title": "hk-industry-leaders-finder",
          }
        : {}),
    },
    body: JSON.stringify({
      model: llmModel(),
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty content");

  let parsed: { classifications?: unknown };
  try {
    parsed = JSON.parse(content) as { classifications?: unknown };
  } catch {
    throw new Error("LLM response was not valid JSON");
  }

  const rows = Array.isArray(parsed.classifications) ? parsed.classifications : [];
  const byDomain = new Map<string, OperatorClassification>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const domain = typeof r.domain === "string" ? r.domain.trim().toLowerCase() : "";
    if (!domain) continue;
    const labelRaw = r.label;
    const label =
      labelRaw === "operator" || labelRaw === "referrer" || labelRaw === "uncertain"
        ? labelRaw
        : "uncertain";
    const confidence =
      typeof r.confidence === "number" && Number.isFinite(r.confidence)
        ? Math.min(1, Math.max(0, r.confidence))
        : 0.5;
    const reasons = Array.isArray(r.reasons)
      ? r.reasons.filter((x): x is string => typeof x === "string").slice(0, 8)
      : [];
    const companyName =
      typeof r.companyName === "string" && r.companyName.trim()
        ? r.companyName.trim()
        : undefined;
    byDomain.set(domain, { domain, label, companyName, confidence, reasons });
  }

  return signals.map((s) => {
    const hit = byDomain.get(s.domain);
    if (hit) return hit;
    return {
      domain: s.domain,
      label: "uncertain" as const,
      confidence: 0,
      reasons: ["missing_from_llm_batch"],
    };
  });
}
