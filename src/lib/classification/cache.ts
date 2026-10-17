import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { normalizeDomain } from "@/lib/ranking/aggregators";
import type { OperatorClassification, OperatorLabel } from "./types";

const { domainClassifications } = schema;

export async function loadClassificationCache(
  keyword: string,
  domains: string[],
): Promise<Map<string, OperatorClassification>> {
  const normalized = [...new Set(domains.map((d) => normalizeDomain(d)).filter(Boolean))];
  const out = new Map<string, OperatorClassification>();
  if (!normalized.length) return out;

  const db = getDb();
  const rows = await db
    .select()
    .from(domainClassifications)
    .where(
      and(
        eq(domainClassifications.keyword, keyword),
        inArray(domainClassifications.domain, normalized),
      ),
    );

  for (const row of rows) {
    out.set(row.domain, {
      domain: row.domain,
      label: row.label as OperatorLabel,
      companyName: row.companyName ?? undefined,
      confidence: row.confidence,
      reasons: row.reasons ?? [],
    });
  }
  return out;
}

export async function saveClassificationCache(
  keyword: string,
  items: OperatorClassification[],
): Promise<void> {
  if (!items.length) return;
  const db = getDb();
  for (const item of items) {
    const domain = normalizeDomain(item.domain);
    if (!domain) continue;
    await db
      .insert(domainClassifications)
      .values({
        domain,
        keyword,
        label: item.label,
        companyName: item.companyName ?? null,
        confidence: item.confidence,
        reasons: item.reasons,
      })
      .onConflictDoUpdate({
        target: [domainClassifications.domain, domainClassifications.keyword],
        set: {
          label: item.label,
          companyName: item.companyName ?? null,
          confidence: item.confidence,
          reasons: item.reasons,
        },
      });
  }
}
