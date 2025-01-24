// Load env for local development
import '../src/setup-env';

import { IToken, tokensTable } from '../src/db/schema';
import { UToken } from '../src/types';
import { db } from '../src/db/client';
import { runScript } from '../src/utils';

// Change object structure to match schema. Convert `platforms` into `networks`
function getFormattedTokens(tokens: UToken[]): IToken[] {
  return tokens.map<IToken>((token) => {
    const networks = Object.entries(token.platforms).map(
      ([networkId, address = '']) => ({
        networkId,
        address,
      })
    );

    return {
      coingeckoId: token.id,
      name: token.name,
      symbol: token.symbol,
      networks,
      updatedAt: Math.floor(Date.now() / 1000),
    };
  });
}

async function updateTokenList() {
  // Fetch tokens from upstream API
  const response = await fetch(process.env.UPSTREAM_TOKEN_LIST_API_URL!, {
    headers: {
      accept: 'application/json',
      'x-cg-pro-api-key': process.env.UPSTREAM_API_KEY!,
    },
  });
  const uTokens = (await response.json()) as UToken[];

  // Fetch tokens from DB
  const dbTokens = await db
    .select({ id: tokensTable.coingeckoId })
    .from(tokensTable);

  // DB tokens IDs
  const dbTokensIDs = dbTokens.map((token) => token.id);

  // New tokens from upstream API that are not in the DB
  const newTokens = uTokens.filter((item) => !dbTokensIDs.includes(item.id));

  // Update the DB if there are new tokens
  if (newTokens.length) {
    console.log('FOUND NEW TOKENS :::', JSON.stringify(newTokens));
    const formattedTokens = getFormattedTokens(newTokens);

    await db.insert(tokensTable).values(formattedTokens);
  } else {
    console.log('NO NEW TOKENS FOUND');
  }
}

runScript(updateTokenList);
