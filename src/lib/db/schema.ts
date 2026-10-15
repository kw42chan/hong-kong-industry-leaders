import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { CitedSource, Leader, ParsedSerp } from "../types";
import { SEARCH_STATUSES } from "../types";

export const searchStatus = pgEnum("search_status", SEARCH_STATUSES);

export const queryStatus = pgEnum("query_status", [
  "pending",
  "posted",
  "ready",
  "failed",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const searches = pgTable(
  "searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    keyword: text("keyword").notNull(),
    locale: text("locale").notNull(),
    status: searchStatus("status").notNull().default("queued"),
    ...timestamps,
  },
  (t) => [index("searches_status_idx").on(t.status)],
);

export const searchQueries = pgTable(
  "search_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    searchId: uuid("search_id")
      .notNull()
      .references(() => searches.id, { onDelete: "cascade" }),
    queryText: text("query_text").notNull(),
    dataforseoTaskId: text("dataforseo_task_id").unique(),
    status: queryStatus("status").notNull().default("pending"),
    ...timestamps,
  },
  (t) => [
    index("search_queries_search_id_idx").on(t.searchId),
    index("search_queries_status_idx").on(t.status),
  ],
);

export const serpSnapshots = pgTable(
  "serp_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queryId: uuid("query_id")
      .notNull()
      .references(() => searchQueries.id, { onDelete: "cascade" }),
    rawJson: jsonb("raw_json").notNull(),
    parsedJson: jsonb("parsed_json").$type<ParsedSerp>(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("serp_snapshots_query_id_idx").on(t.queryId)],
);

export interface LeadersJson {
  leaders: Leader[];
  citedSources: CitedSource[];
}

export const results = pgTable("results", {
  id: uuid("id").primaryKey().defaultRandom(),
  searchId: uuid("search_id")
    .notNull()
    .unique()
    .references(() => searches.id, { onDelete: "cascade" }),
  leadersJson: jsonb("leaders_json").$type<LeadersJson>().notNull(),
  createdAt: timestamps.createdAt,
});

export type Search = typeof searches.$inferSelect;
export type NewSearch = typeof searches.$inferInsert;
export type SearchQuery = typeof searchQueries.$inferSelect;
export type NewSearchQuery = typeof searchQueries.$inferInsert;
export type SerpSnapshot = typeof serpSnapshots.$inferSelect;
export type NewSerpSnapshot = typeof serpSnapshots.$inferInsert;
export type Result = typeof results.$inferSelect;
export type NewResult = typeof results.$inferInsert;
