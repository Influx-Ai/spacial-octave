export interface UToken {
  id: string;
  symbol: string;
  name: string;
  platforms: {
    [key: string]: string;
  };
}
