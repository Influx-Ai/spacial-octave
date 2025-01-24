import { bigint, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

export const tokensTable = pgTable(process.env.PG_TOKENS_TABLE_NAME!, {
  coingeckoId: text('coingeckoId').notNull(),
  name: text('name').notNull(),
  networks: jsonb('networks')
    .$type<{ networkId: string; address: string }[]>()
    .notNull()
    .default([]),
  symbol: text('symbol').notNull(),
  createdAt: bigint('createdAt', { mode: 'number' })
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: bigint('updatedAt', { mode: 'number' })
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export type IToken = typeof tokensTable.$inferInsert;
