export interface UToken {
  id: string;
  symbol: string;
  name: string;
  platforms: {
    [key: string]: string;
  };
}

export interface UTokenWithMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;

  current_price: number;
  sparkline_in_7d: {
    price: number[];
  };
  price_change_percentage_24h_in_currency: number;
  price_change_percentage_7d_in_currency: number;
  price_change_percentage_30d_in_currency: number;
  price_change_percentage_1y_in_currency: number;

  market_cap: number;
  market_cap_rank: number;
  circulating_supply: number;
  fully_diluted_valuation: number;
  total_supply: number;
}
