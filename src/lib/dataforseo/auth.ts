import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time comparison; false if either side is empty. */
export function secretsMatch(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** `${APP_URL}/api/dataforseo/postback?secret=…`; throws if env is missing. */
export function buildPostbackUrl(): string {
  const appUrl = process.env.APP_URL;
  const secret = process.env.POSTBACK_SECRET;
  if (!appUrl || !secret) {
    throw new Error("APP_URL and POSTBACK_SECRET must be set");
  }
  const url = new URL("/api/dataforseo/postback", appUrl);
  url.searchParams.set("secret", secret);
  return url.toString();
}
