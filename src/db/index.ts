import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }
  const needsSsl = /sslmode=require/.test(connectionString);
  return new Pool({
    connectionString,
    max: 5,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

// Reuse the pool across hot reloads in dev and warm serverless invocations.
const pool = globalForDb.pool ?? createPool();
globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
