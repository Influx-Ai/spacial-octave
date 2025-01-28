import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const sslConfig = {
  rejectUnauthorized: true,
  ca: process.env.CA_CERT,
};

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

export const db = drizzle(pool);
