export type AssetClass =
  | "us_stock"
  | "intl_stock"
  | "bond"
  | "cash"
  | "real_estate"
  | "other";

export const ASSET_CLASS_CONFIG: Record<
  AssetClass,
  { label: string; color: string }
> = {
  us_stock: { label: "US Stocks", color: "#3B82F6" },
  intl_stock: { label: "International Stocks", color: "#8B5CF6" },
  bond: { label: "Bonds", color: "#22C55E" },
  cash: { label: "Cash", color: "#6B7280" },
  real_estate: { label: "Real Estate", color: "#F59E0B" },
  other: { label: "Other", color: "#EF4444" },
};

export const ASSET_CLASSES: AssetClass[] = [
  "us_stock",
  "intl_stock",
  "bond",
  "cash",
  "real_estate",
  "other",
];

export const INVESTMENT_ACCOUNT_TYPES = [
  "401k",
  "403b",
  "traditional_ira",
  "roth_ira",
  "roth_401k",
  "brokerage",
] as const;

export type InvestmentAccountType = (typeof INVESTMENT_ACCOUNT_TYPES)[number];

export const DEFAULT_REBALANCE_THRESHOLD = 0.05; // 5%
