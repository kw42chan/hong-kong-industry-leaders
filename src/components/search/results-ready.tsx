import { useFormatter, useTranslations } from "next-intl";
import type {
  CitedSource,
  Leader,
  SearchQuerySummary,
  SearchResultDTO,
} from "@/lib/types";

const thClass = "px-3 py-2 text-start font-medium whitespace-nowrap";
const tdClass = "px-3 py-3 align-top";

function ExternalDomainLink({ domain, children }: { domain: string; children: React.ReactNode }) {
  const t = useTranslations("Leaders");
  return (
    <a
      href={`https://${domain}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-current/30 underline-offset-2 hover:decoration-current focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      {children}
      <span className="sr-only"> {t("opensInNewTab")}</span>
    </a>
  );
}

function LeadersTable({ leaders }: { leaders: Leader[] }) {
  const t = useTranslations("Leaders");
  const format = useFormatter();

  return (
    <section aria-labelledby="leaders-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="leaders-heading" className="text-xl font-semibold">
          {t("heading")}
        </h2>
        <p className="text-sm opacity-70">{t("description")}</p>
      </div>
      {leaders.length === 0 ? (
        <p className="opacity-80">{t("empty")}</p>
      ) : (
        <div
          className="overflow-x-auto rounded-lg border border-current/15"
          role="region"
          aria-labelledby="leaders-heading"
          tabIndex={0}
        >
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <caption className="sr-only">{t("heading")}</caption>
            <thead className="bg-current/5">
              <tr>
                <th scope="col" className={thClass}>{t("colRank")}</th>
                <th scope="col" className={thClass}>{t("colName")}</th>
                <th scope="col" className={`${thClass} text-end`}>{t("colScore")}</th>
                <th scope="col" className={`${thClass} text-end`}>{t("colAioMentions")}</th>
                <th scope="col" className={`${thClass} text-end`}>{t("colAioCitations")}</th>
                <th scope="col" className={`${thClass} text-end`}>{t("colBestOrganic")}</th>
                <th scope="col" className={thClass}>{t("colQueries")}</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((leader, i) => (
                <tr key={leader.domain} className="border-t border-current/10">
                  <td className={`${tdClass} font-semibold tabular-nums`}>{i + 1}</td>
                  <th scope="row" className={`${tdClass} text-start font-normal`}>
                    <div className="font-medium">{leader.name}</div>
                    <div className="text-xs opacity-75">
                      <ExternalDomainLink domain={leader.domain}>{leader.domain}</ExternalDomainLink>
                    </div>
                  </th>
                  <td className={`${tdClass} text-end font-semibold tabular-nums`}>
                    {format.number(leader.score, { maximumFractionDigits: 1 })}
                  </td>
                  <td className={`${tdClass} text-end tabular-nums`}>{leader.aioMentions}</td>
                  <td className={`${tdClass} text-end tabular-nums`}>{leader.aioCitations}</td>
                  <td className={`${tdClass} text-end tabular-nums`}>
                    {leader.bestOrganicRank === null ? (
                      <>
                        <span aria-hidden="true">{t("notRanked")}</span>
                        <span className="sr-only">{t("notRankedLabel")}</span>
                      </>
                    ) : (
                      `#${leader.bestOrganicRank}`
                    )}
                  </td>
                  <td className={tdClass}>
                    <details>
                      <summary className="cursor-pointer whitespace-nowrap">
                        {t("queriesCount", { count: leader.queriesAppeared.length })}
                      </summary>
                      <ul className="mt-1 list-disc ps-5 text-xs opacity-80">
                        {leader.queriesAppeared.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CitedSources({ sources }: { sources: CitedSource[] }) {
  const t = useTranslations("Sources");
  return (
    <section aria-labelledby="sources-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="sources-heading" className="text-xl font-semibold">
          {t("heading")}
        </h2>
        <p className="text-sm opacity-70">{t("description")}</p>
      </div>
      {sources.length === 0 ? (
        <p className="opacity-80">{t("empty")}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {sources.map((s) => (
            <li
              key={s.domain}
              className="flex items-center justify-between gap-3 rounded-lg border border-current/15 px-3 py-2 text-sm"
            >
              <ExternalDomainLink domain={s.domain}>{s.domain}</ExternalDomainLink>
              <span className="shrink-0 tabular-nums opacity-75">
                {t("citations", { count: s.count })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QueryList({ queries }: { queries: SearchQuerySummary[] }) {
  const t = useTranslations("Queries");
  return (
    <section aria-labelledby="queries-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="queries-heading" className="text-xl font-semibold">
          {t("heading")}
        </h2>
        <p className="text-sm opacity-70">{t("description")}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-current/15">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t("heading")}</caption>
          <thead className="bg-current/5">
            <tr>
              <th scope="col" className={thClass}>{t("colQuery")}</th>
              <th scope="col" className={`${thClass} text-end`}>{t("colAio")}</th>
            </tr>
          </thead>
          <tbody>
            {queries.map((q) => (
              <tr key={q.text} className="border-t border-current/10">
                <td className="px-3 py-2">{q.text}</td>
                <td className="px-3 py-2 text-end">
                  <span
                    className={
                      q.aiOverviewPresent
                        ? "rounded-full bg-green-600/15 px-2 py-0.5 text-green-800 dark:text-green-300"
                        : "rounded-full bg-current/10 px-2 py-0.5 opacity-80"
                    }
                  >
                    {q.aiOverviewPresent ? t("yes") : t("no")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ResultsReady({ result }: { result: SearchResultDTO }) {
  const t = useTranslations("Search");
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-10">
      {result.scrapedAt && (
        <p className="text-sm opacity-70">
          {t("scrapedAt", {
            date: format.dateTime(new Date(result.scrapedAt), {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Hong_Kong",
            }),
          })}
        </p>
      )}
      <LeadersTable leaders={result.leaders} />
      <CitedSources sources={result.citedSources} />
      <QueryList queries={result.queries} />
    </div>
  );
}
