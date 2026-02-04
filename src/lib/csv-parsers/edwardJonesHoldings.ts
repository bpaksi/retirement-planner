import Papa from "papaparse";

export interface ParsedHolding {
  type: string; // "Stocks", "Mutual Funds", etc.
  symbol: string;
  name: string;
  shares: number;
  currentValue: number;
  costBasis?: number;
  lastPrice?: number;
  unrealizedGainLoss?: number;
  assetClass: "us_stock" | "intl_stock" | "bond" | "cash" | "real_estate" | "other";
}

export interface HoldingsParseResult {
  holdings: ParsedHolding[];
  totalValue: number;
  errors: string[];
  accountName?: string;
  asOfDate?: Date;
}

// International stock symbols (Canadian, European, etc.)
const INTL_SYMBOLS = new Set(["ENB", "TTE"]);

// Bond-related keywords in fund names
const BOND_KEYWORDS = ["BOND", "FIXED INCOME", "INCOME", "TREASURY", "GOVT"];

// Short-term/cash-like fund keywords
const CASH_KEYWORDS = ["MONEY MKT", "MONEY MARKET", "ULTRA SHORT", "SHORT TERM", "CONSERVATIVE INCOME"];

/**
 * Determine asset class based on type and holding details
 */
function determineAssetClass(
  type: string,
  symbol: string,
  name: string
): ParsedHolding["assetClass"] {
  const upperName = name.toUpperCase();
  const upperType = type.toUpperCase();

  // Cash & Money Market
  if (upperType.includes("CASH") || upperType.includes("MONEY MARKET")) {
    return "cash";
  }

  // Check for cash-like funds
  if (CASH_KEYWORDS.some((kw) => upperName.includes(kw))) {
    return "cash";
  }

  // Stocks
  if (upperType === "STOCKS") {
    // Check for international stocks
    if (INTL_SYMBOLS.has(symbol.toUpperCase())) {
      return "intl_stock";
    }
    return "us_stock";
  }

  // Exchange-Traded & Closed End Funds
  if (upperType.includes("EXCHANGE-TRADED") || upperType.includes("ETF")) {
    // Check for bond ETFs
    if (BOND_KEYWORDS.some((kw) => upperName.includes(kw))) {
      return "bond";
    }
    // Check for international ETFs
    if (upperName.includes("INTL") || upperName.includes("INTERNATIONAL")) {
      return "intl_stock";
    }
    // Default ETFs to US stock (dividend-focused, broad market, etc.)
    return "us_stock";
  }

  // Mutual Funds
  if (upperType.includes("MUTUAL FUND")) {
    // Check for bond funds
    if (BOND_KEYWORDS.some((kw) => upperName.includes(kw))) {
      return "bond";
    }
    // Check for international funds
    if (upperName.includes("INTL") || upperName.includes("INTERNATIONAL")) {
      return "intl_stock";
    }
    return "other";
  }

  return "other";
}

/**
 * Detect if content is an Edward Jones holdings CSV
 */
export function isEdwardJonesHoldingsFile(content: string): boolean {
  const lines = content.split("\n");
  if (lines.length < 4) return false;

  // First line should be account info with timestamp
  // Second line is empty
  // Third line is empty
  // Fourth line is headers
  const headerLine = lines.find((line) =>
    line.includes("TYPE,SYMBOL/CUSIP,DESCRIPTION")
  );

  return !!headerLine;
}

/**
 * Parse Edward Jones holdings CSV content
 */
export function parseEdwardJonesHoldings(content: string): HoldingsParseResult {
  const lines = content.split("\n");
  const errors: string[] = [];
  const holdings: ParsedHolding[] = [];

  // Parse account info from first line
  // Format: "RJP Roth Tuesday, February 3, 2026 at 5:10:32 PM Central Standard Time"
  let accountName: string | undefined;
  let asOfDate: Date | undefined;

  if (lines[0]) {
    const firstLine = lines[0].trim();
    // Try to extract account name (everything before the day name)
    const dayNames = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    for (const day of dayNames) {
      const idx = firstLine.indexOf(day);
      if (idx > 0) {
        accountName = firstLine.substring(0, idx).trim();
        // Try to parse date
        const dateMatch = firstLine.match(
          /(\w+), (\w+ \d+, \d{4}) at (\d+:\d+:\d+ [AP]M)/
        );
        if (dateMatch) {
          try {
            asOfDate = new Date(`${dateMatch[2]} ${dateMatch[3]}`);
          } catch {
            // Date parsing failed, continue without it
          }
        }
        break;
      }
    }
  }

  // Find the header line
  const headerLineIndex = lines.findIndex((line) =>
    line.includes("TYPE,SYMBOL/CUSIP,DESCRIPTION")
  );

  if (headerLineIndex === -1) {
    return {
      holdings: [],
      totalValue: 0,
      errors: ["Could not find header line in holdings CSV"],
    };
  }

  // Parse from header line onwards
  const csvContent = lines.slice(headerLineIndex).join("\n");

  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    result.errors.forEach((e) => {
      errors.push(`Row ${e.row}: ${e.message}`);
    });
  }

  let totalValue = 0;

  for (const row of result.data as Record<string, string>[]) {
    const type = row["TYPE"]?.trim();
    const symbol = row["SYMBOL/CUSIP"]?.trim();
    const description = row["DESCRIPTION"]?.trim();
    const sharesStr = row["SHARES"]?.trim();
    const valueStr = row["ESTIMATED CURRENT VALUE"]?.trim();
    const costBasisStr = row["COST BASIS"]?.trim();
    const priceStr = row["PRICE/SHARE"]?.trim();
    const gainLossStr = row["UNREALIZED GAIN LOSS"]?.trim();

    // Skip empty rows and total row
    if (!type || !description) continue;
    if (!sharesStr && !valueStr) continue;

    // Parse numeric values
    const parseNumber = (str: string | undefined): number | undefined => {
      if (!str || str === "null" || str === "") return undefined;
      const cleaned = str.replace(/[$,]/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? undefined : num;
    };

    const shares = parseNumber(sharesStr) ?? 0;
    const currentValue = parseNumber(valueStr) ?? 0;
    const costBasis = parseNumber(costBasisStr);
    const lastPrice = parseNumber(priceStr);
    const unrealizedGainLoss = parseNumber(gainLossStr);

    // Skip if no value (likely a header or empty row)
    if (currentValue === 0 && shares === 0) continue;

    // Use symbol if available, otherwise generate from description
    const holdingSymbol = symbol || description.substring(0, 8).toUpperCase().replace(/\s+/g, "");

    const assetClass = determineAssetClass(type, holdingSymbol, description);

    holdings.push({
      type,
      symbol: holdingSymbol,
      name: description,
      shares,
      currentValue,
      costBasis,
      lastPrice,
      unrealizedGainLoss,
      assetClass,
    });

    totalValue += currentValue;
  }

  return {
    holdings,
    totalValue,
    errors,
    accountName,
    asOfDate,
  };
}
