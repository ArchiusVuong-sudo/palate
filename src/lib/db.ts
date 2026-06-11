import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __palatePool: Pool | undefined;
}

export const pool: Pool =
  global.__palatePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // serverless: keep per-instance connections tiny and release them fast —
    // on Vercel we sit behind Supabase's transaction-mode pooler (port 6543),
    // which multiplexes many clients over a small backend pool
    max: process.env.VERCEL ? 3 : 8,
    idleTimeoutMillis: process.env.VERCEL ? 8_000 : 30_000,
    allowExitOnIdle: Boolean(process.env.VERCEL),
  });

// cache across HMR (dev) AND across warm lambda invocations (Vercel)
global.__palatePool = pool;

export async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}
