import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { db?: Db };

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle(postgres(url, { max: 10 }), { schema });
}

/** Lazily created so `next build` works without a database. */
export function getDb(): Db {
  if (!globalForDb.db) {
    globalForDb.db = createDb();
  }
  return globalForDb.db;
}

export { schema };
