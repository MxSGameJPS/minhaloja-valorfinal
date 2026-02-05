import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
