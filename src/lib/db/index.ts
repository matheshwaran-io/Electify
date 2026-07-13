import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

function getPool(): Pool {
  if (process.env.NODE_ENV === "production") {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }

  // Reuse pool in development to avoid exhausting connections during HMR
  if (!globalForDb.pool) {
    globalForDb.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }
  return globalForDb.pool;
}

const pool = getPool();

export const db = drizzle(pool, { schema });
export default db;

// Re-export schema for convenience
export * from "./schema";
