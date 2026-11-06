import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }
  // SSL settings come from the connection string (Neon's includes sslmode=require).
  const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
  // Without a listener, an idle connection dropped by the server (common on
  // serverless Postgres) would crash the whole process instead of one request.
  pool.on("error", (err) => console.error("Postgres pool error:", err.message));
  return pool;
}

// Reuse the pool across hot reloads in dev and warm serverless invocations.
const pool = globalForDb.pool ?? createPool();
globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
