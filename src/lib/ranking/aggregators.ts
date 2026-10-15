/**
 * Third-party domains (encyclopedias, review/listing sites, news, social,
 * directories, government) that are never treated as industry leaders.
 * They are reported separately as "frequently cited sources".
 *
 * Entries match the domain itself and any subdomain of it, so `gov.hk`
 * covers `www.cr.gov.hk`, and `wikipedia.org` covers `zh.wikipedia.org`.
 */
export const AGGREGATOR_DOMAINS: readonly string[] = [
  // Encyclopedias / Q&A / forums
  "wikipedia.org",
  "baike.baidu.com",
  "zhihu.com",
  "quora.com",
  "reddit.com",
  "discuss.com.hk",
  "lihkg.com",
  "baby-kingdom.com",
  "uwants.com",

  // Reviews, listings and directories
  "openrice.com",
  "price.com.hk",
  "yelp.com",
  "yelp.com.hk",
  "tripadvisor.com",
  "tripadvisor.com.hk",
  "yp.com.hk",
  "hkcompanydirectory.com",
  "hktdc.com",
  "google.com",
  "google.com.hk",
  "trustpilot.com",
  "clutch.co",
  "sortlist.com",
  "goodfirms.co",
  "jobsdb.com",
  "indeed.com",
  "glassdoor.com",
  "ctgoodjobs.hk",
  "klook.com",
  "groupon.com",
  "hellotoby.com",
  "sundaykiss.com",
  "timeout.com",
  "hk.trip.com",
  "trip.com",

  // News and media
  "hk01.com",
  "scmp.com",
  "mingpao.com",
  "hket.com",
  "on.cc",
  "orientaldaily.on.cc",
  "rthk.hk",
  "news.rthk.hk",
  "thestandard.com.hk",
  "hkej.com",
  "am730.com.hk",
  "stheadline.com",
  "singtao.com",
  "tvb.com",
  "now.com",
  "news.now.com",
  "bastillepost.com",
  "hk.news.yahoo.com",
  "yahoo.com",
  "bbc.com",
  "cnn.com",
  "bloomberg.com",
  "reuters.com",
  "theguardian.com",
  "medium.com",
  "harbourtimes.com",
  "hongkongfp.com",
  "ulifestyle.com.hk",
  "esquirehk.com",
  "marieclaire.com.hk",
  "cosmopolitan.com.hk",
  "elle.com.hk",
  "jetso.com",
  "eatandtravel.com.hk",

  // Social and video
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "threads.net",
  "tiktok.com",
  "pinterest.com",
  "xiaohongshu.com",
  "weibo.com",
  "wa.me",
  "whatsapp.com",

  // Government and public bodies
  "gov.hk",
  "hkma.gov.hk",
  "hkicpa.org.hk",
];

/**
 * Lowercase, strip protocol / path / port / trailing dot and a leading
 * `www.`. Accepts a bare host or a full URL.
 */
export function normalizeDomain(input: string): string {
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  host = host.split(/[/?#]/)[0] ?? "";
  host = host.replace(/^[^@]*@/, "");
  host = host.replace(/:\d+$/, "");
  host = host.replace(/\.+$/, "");
  host = host.replace(/^www\./, "");
  return host;
}

export function isAggregatorDomain(domain: string): boolean {
  const host = normalizeDomain(domain);
  if (!host) return false;
  return AGGREGATOR_DOMAINS.some(
    (entry) => host === entry || host.endsWith(`.${entry}`),
  );
}
