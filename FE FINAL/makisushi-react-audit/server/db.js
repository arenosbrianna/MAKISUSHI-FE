import pg from "pg";

// Keep DATE values as "YYYY-MM-DD" strings, numeric as numbers, bigint as numbers.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// Supabase requires SSL; the pooler certificate is accepted here.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 4,
});
