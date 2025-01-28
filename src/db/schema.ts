import { sql } from 'drizzle-orm';
import {
  bigint,
  doublePrecision,
  jsonb,
  pgTable,
  real,
  text,
} from 'drizzle-orm/pg-core';

export const tokensTable = pgTable(process.env.PG_TOKENS_TABLE_NAME!, {
  coingeckoId: text('coingeckoId').notNull(),
  name: text('name').notNull(),
  networks: jsonb('networks')
    .$type<{ networkId: string; address: string }[]>()
    .notNull()
    .default([]),
  symbol: text('symbol').notNull(),

  // Market Data (Price Changes)
  price: doublePrecision('price'),
  priceChange: text('priceChange')
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  priceChangePercentage24hr: real('priceChangePercentage24hr'),
  priceChangePercentage7days: real('priceChangePercentage7days'),
  priceChangePercentage30days: real('priceChangePercentage30days'),
  priceChangePercentage1yr: real('priceChangePercentage1yr'),

  // Market Data (Others)
  marketCap: doublePrecision('marketCap'),
  circulatingSupply: doublePrecision('circulatingSupply'),
  fullyDilutedValuation: doublePrecision('fullyDilutedValuation'),
  totalSupply: doublePrecision('totalSupply'),

  // Timestamp
  createdAt: bigint('createdAt', { mode: 'number' })
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: bigint('updatedAt', { mode: 'number' })
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export type IToken = typeof tokensTable.$inferInsert;
