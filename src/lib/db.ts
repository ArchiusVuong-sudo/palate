import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __palatePool: Pool | undefined;
}

export const pool: Pool =
  global.__palatePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") global.__palatePool = pool;

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
