// Load env for local development
import '../src/setup-env';

import { db } from '../src/db/client';
import { tokensTable, IToken } from '../src/db/schema';
import { runScript, wait } from '../src/utils';
import { UTokenWithMarketData } from '../src/types';
import { eq } from 'drizzle-orm';

const WAIT_TIME_AFTER_FAILURE = 5; // In seconds
const NUMBER_OF_CONCURRENT_REQUESTS = 250; // Number of concurrent requested token IDs
const REQUEST_SUBTRACT_VALUE = 10; // Value to subtract from the number of concurrent requests to avoid `URI Too Long` error

async function getTokensIDs(): Promise<string[]> {
  // Get a list of all token IDs from the DB
  const tokensIDs = await db
    .select({ id: tokensTable.coingeckoId })
    .from(tokensTable);

  return tokensIDs.map((token) => token.id);
}

async function getTokensWithMarketData(
  _tokenIDs: string[]
): Promise<UTokenWithMarketData[]> {
  // All token IDs
  let tokenIDs = [..._tokenIDs];

  // Define an empty array of tokens to store tokens
  let tokensWithMarketData: UTokenWithMarketData[] = [];

  // Initialize the subtraction value to zero
  let requestSubtraction = 0;

  while (tokenIDs.length) {
    // Actual number of concurrent requests
    const noOfConcurrentRequestsAfterSubtraction =
      NUMBER_OF_CONCURRENT_REQUESTS - requestSubtraction;
    const batchIDs = tokenIDs.slice(0, noOfConcurrentRequestsAfterSubtraction);

    try {
      const firstTwoIDs = batchIDs.slice(0, 2);
      const lastTwoIDs = batchIDs.slice(-2);
      console.log(
        `Fetching tokens market data with IDs: ${firstTwoIDs},...,${lastTwoIDs}`
      );

      // Fetch 630 or less (rate limited) tokens with market data
      const responseWithMarketData = await fetch(
        `${process.env
          .UPSTREAM_TOKEN_LIST_WITH_MARKET_DATA_API_URL!}&ids=${batchIDs.join(
          ','
        )}`,
        {
          headers: {
            accept: 'application/json',
            'x-cg-pro-api-key': process.env.UPSTREAM_API_KEY!,
          },
        }
      );
      if (!responseWithMarketData.ok) {
        throw new Error(responseWithMarketData.statusText);
      }

      const _tokensWithMarketData =
        (await responseWithMarketData.json()) as UTokenWithMarketData[];

      console.log(
        `Expected: ${batchIDs.length} | Received: ${_tokensWithMarketData.length} | Remaining: ${tokenIDs.length}`
      );

      // Add 630 or less tokens to the tokens array
      tokensWithMarketData.push(..._tokensWithMarketData);

      // On success, remove the fetched tokens from the array
      tokenIDs = tokenIDs.filter((id) => !batchIDs.includes(id));

      // Reset no of concurrent request to initial
      requestSubtraction = 0;

      await wait(0.04); // Wait for 40ms to avoid rate limiting
    } catch (error: any) {
      if (error instanceof Error) {
        // If the error is due to rate limiting, wait for a few seconds
        if (error.message.includes('Throttled')) {
          console.log(`Waiting for ${WAIT_TIME_AFTER_FAILURE} seconds`);
          await wait(WAIT_TIME_AFTER_FAILURE);
        }
        // If the error is due to the URI being Too Long, reduce the number of concurrent requested token IDs by 10
        else if (error.message.includes('URI Too Long')) {
          console.log(
            `Reducing the number of concurrent requests by ${REQUEST_SUBTRACT_VALUE}`
          );
          requestSubtraction += REQUEST_SUBTRACT_VALUE;
        } else {
          throw new Error(
            `An error occurred while fetching tokens with market data :::\n${error.message}`
          );
        }
      }
      // If there's an unknown error, throw it to the main thread
      else {
        throw new Error(
          `An error occurred while fetching tokens with market data :::\n${error}`
        );
      }
    }

    console.log('\n------------------------------------\n');
  }

  return tokensWithMarketData;
}

function getFormattedTokens(
  tokenIDs: string[],
  tokensWithMarketData: UTokenWithMarketData[]
): IToken[] {
  const formattedTokens = tokenIDs.map<IToken | undefined>((tokenID) => {
    const tokenWithMarketData = tokensWithMarketData.find(
      (token) => token.id === tokenID
    );

    if (!tokenWithMarketData) return undefined;

    return {
      coingeckoId: tokenWithMarketData.id,
      imageUrl: tokenWithMarketData.image || '',
      name: tokenWithMarketData.name,
      symbol: tokenWithMarketData.symbol,

      // Market Data (Price Changes)
      price: tokenWithMarketData.current_price || -1,
      priceChange: (tokenWithMarketData.sparkline_in_7d.price || []).map(
        String
      ),
      priceChangePercentage24hr:
        tokenWithMarketData.price_change_percentage_24h_in_currency || -1,
      priceChangePercentage7days:
        tokenWithMarketData.price_change_percentage_7d_in_currency || -1,
      priceChangePercentage30days:
        tokenWithMarketData.price_change_percentage_30d_in_currency || -1,
      priceChangePercentage1yr:
        tokenWithMarketData.price_change_percentage_1y_in_currency || -1,

      // Market Data (Others)
      marketCap: tokenWithMarketData.market_cap || -1,
      circulatingSupply: tokenWithMarketData.circulating_supply || -1,
      fullyDilutedValuation: tokenWithMarketData.fully_diluted_valuation || -1,
      totalSupply: tokenWithMarketData.total_supply || -1,

      // Timestamp
      updatedAt: Math.floor(Date.now() / 1000),
    };
  });

  return formattedTokens.filter((i) => !!i);
}

const NUMBER_OF_CONCURRENT_DB_UPDATES = 100;

async function updateDBInBatches(formattedTokens: IToken[]): Promise<number> {
  // Spread array to lose reference to the original array
  const tokens = [...formattedTokens];

  let updatedTokenCount = 0;

  while (tokens.length) {
    const tokenBatch = tokens.splice(0, NUMBER_OF_CONCURRENT_DB_UPDATES);
    const firstTwoTokens = tokenBatch
      .slice(0, 2)
      .map((i) => i.coingeckoId)
      .join(', ');
    const lastTwoTokens = tokenBatch
      .slice(-2)
      .map((i) => i.coingeckoId)
      .join(', ');
    const log = `${firstTwoTokens},...,${lastTwoTokens}`;

    try {
      console.log('Updating :::', log);
      const tokenBatchPromise = tokenBatch.map(async (token) => {
        try {
          await db
            .update(tokensTable)
            .set(token)
            .where(eq(tokensTable.coingeckoId, token.coingeckoId));
          updatedTokenCount++;
        } catch (error) {
          console.error(
            `Failed to update token: ${token.coingeckoId} :::`,
            error
          );
        }
      });
      await Promise.all(tokenBatchPromise);
      await wait(0.1);
    } catch (error: any) {
      throw `A Bacth Update Error Occurred :::\n${log}\n${error}`;
    }
  }

  return updatedTokenCount;
}

export async function updateTokensMarketData() {
  // Get an array of bare objects of all tokens from upstream API
  console.log('Fetching token IDs from DB');
  const tokenIDs = await getTokensIDs();
  console.log(`Found ${tokenIDs.length} token IDs in DB`);

  console.log('\n------------------------------------\n');

  // Fetch tokens market data
  console.log("Fetching tokens' market data in batches based on IDs...\n");
  const tokensWithMarketData = await getTokensWithMarketData(tokenIDs);
  console.log(
    `Total tokens with market data fetched from upstream: ${tokensWithMarketData.length}`
  );

  console.log('\n------------------------------------\n');

  // Aggregated token values
  const formattedTokens = getFormattedTokens(tokenIDs, tokensWithMarketData);

  // Update the DB
  console.log(
    `Updating ${formattedTokens.length} tokens' market data to DB...\n`
  );
  const updatedTokenCount = await updateDBInBatches(formattedTokens);
  console.log('\n------------------------------------\n');
  console.log(
    `Successfully updated ${updatedTokenCount} tokens' market data to DB`
  );
}

runScript(updateTokensMarketData);
