export interface CategorizationRule {
  pattern: RegExp;
  categoryId: string;
  priority: number;
  source: "system" | "user" | "learned";
}

export interface CategorizationResult {
  categoryId: string | null;
  confidence: number;
  matchedRule?: string;
}

// System rules for auto-categorization
// These are also seeded into the database, but kept here for client-side preview
const SYSTEM_RULES: Omit<CategorizationRule, "categoryId">[] = [
  // Income patterns
  { pattern: /PAYROLL|DIRECT DEP|SALARY/i, priority: 100, source: "system" },
  { pattern: /DIVIDEND|DIV\s+|INTEREST/i, priority: 100, source: "system" },

  // Essential expenses
  { pattern: /MORTGAGE|HOME LOAN|RENT\s+PAYMENT/i, priority: 90, source: "system" },
  {
    pattern: /ELECTRIC|GAS\s+CO|WATER\s+UTIL|UTILITY|CONSUMERS ENERGY|GLSWA/i,
    priority: 90,
    source: "system",
  },
  {
    pattern: /KROGER|SAFEWAY|WHOLE\s*FOODS|TRADER\s*JOE|PUBLIX|WEGMANS|ALDI|MEIJER STORE/i,
    priority: 85,
    source: "system",
  },
  {
    pattern: /PHARMACY|CVS|WALGREENS|RITE\s*AID|MEDICATION|BRONSON|HEALTH|MEDICAL/i,
    priority: 85,
    source: "system",
  },
  {
    pattern: /INSURANCE|GEICO|STATE\s*FARM|ALLSTATE|PROGRESSIVE|HANOVER|LIBERTY MUTUAL/i,
    priority: 85,
    source: "system",
  },

  // Gas stations
  {
    pattern: /SHELL|EXXON|CHEVRON|BP|MOBIL|GAS\s*STATION|FUEL|MEIJER EXPRESS|SPEEDWAY/i,
    priority: 80,
    source: "system",
  },

  // Transportation (non-gas)
  { pattern: /UBER|LYFT|TAXI|PARKING|TOLL/i, priority: 80, source: "system" },

  // Discretionary
  {
    pattern:
      /RESTAURANT|DOORDASH|GRUBHUB|UBER\s*EATS|MCDONALD|STARBUCKS|CHIPOTLE|DINING|RED ROBIN|JETS PIZZA|CONEY ISLAND|BAKERY|CAFE|BAR|GRILL|BREWING/i,
    priority: 75,
    source: "system",
  },
  {
    pattern:
      /NETFLIX|HULU|SPOTIFY|DISNEY\+|HBO|AMAZON\s*PRIME|YOUTUBE|PELOTON|PERPLEXITY/i,
    priority: 75,
    source: "system",
  },
  {
    pattern:
      /AMAZON|AMZN|WALMART|TARGET|COSTCO|BEST\s*BUY|BARNES|WILLIAMS-SONOMA|BOUTIQUE|TOY/i,
    priority: 70,
    source: "system",
  },
  {
    pattern: /MOVIE|CINEMA|THEATER|CONCERT|TICKET|CELEBRATION CINEMA|TICKETMASTER/i,
    priority: 70,
    source: "system",
  },
  { pattern: /AIRLINE|HOTEL|AIRBNB|BOOKING\.COM|EXPEDIA/i, priority: 70, source: "system" },

  // Transfers (should not count in spending)
  {
    pattern: /TRANSFER|XFER|VENMO|ZELLE|PAYPAL|AUTOPAY PYMT|CRCARDPMT|PAYMENT\/CREDIT/i,
    priority: 60,
    source: "system",
  },
];

// Map pattern names to category names for client-side preview
const PATTERN_TO_CATEGORY: Record<string, string> = {
  "PAYROLL|DIRECT DEP|SALARY": "Salary",
  "DIVIDEND|DIV\\s+|INTEREST": "Investment Income",
  "MORTGAGE|HOME LOAN|RENT\\s+PAYMENT": "Housing",
  "ELECTRIC|GAS\\s+CO|WATER\\s+UTIL|UTILITY|CONSUMERS ENERGY|GLSWA": "Utilities",
  "KROGER|SAFEWAY|WHOLE\\s*FOODS|TRADER\\s*JOE|PUBLIX|WEGMANS|ALDI|MEIJER STORE": "Groceries",
  "PHARMACY|CVS|WALGREENS|RITE\\s*AID|MEDICATION|BRONSON|HEALTH|MEDICAL": "Healthcare",
  "INSURANCE|GEICO|STATE\\s*FARM|ALLSTATE|PROGRESSIVE|HANOVER|LIBERTY MUTUAL": "Insurance",
  "SHELL|EXXON|CHEVRON|BP|MOBIL|GAS\\s*STATION|FUEL|MEIJER EXPRESS|SPEEDWAY": "Gas",
  "UBER|LYFT|TAXI|PARKING|TOLL": "Transportation",
  "RESTAURANT|DOORDASH|GRUBHUB|UBER\\s*EATS|MCDONALD|STARBUCKS|CHIPOTLE|DINING|RED ROBIN|JETS PIZZA|CONEY ISLAND|BAKERY|CAFE|BAR|GRILL|BREWING":
    "Dining Out",
  "NETFLIX|HULU|SPOTIFY|DISNEY\\+|HBO|AMAZON\\s*PRIME|YOUTUBE|PELOTON|PERPLEXITY":
    "Subscriptions",
  "AMAZON|AMZN|WALMART|TARGET|COSTCO|BEST\\s*BUY|BARNES|WILLIAMS-SONOMA|BOUTIQUE|TOY":
    "Shopping",
  "MOVIE|CINEMA|THEATER|CONCERT|TICKET|CELEBRATION CINEMA|TICKETMASTER": "Entertainment",
  "AIRLINE|HOTEL|AIRBNB|BOOKING\\.COM|EXPEDIA": "Travel",
  "TRANSFER|XFER|VENMO|ZELLE|PAYPAL|AUTOPAY PYMT|CRCARDPMT|PAYMENT\\/CREDIT": "Transfers",
};

/**
 * Categorize a transaction description using system rules
 * Returns the category name (for client-side preview) or null if no match
 */
export function categorizeDescription(description: string): {
  categoryName: string | null;
  confidence: number;
  matchedPattern?: string;
} {
  for (const rule of SYSTEM_RULES) {
    if (rule.pattern.test(description)) {
      const patternStr = rule.pattern.source;
      const categoryName = PATTERN_TO_CATEGORY[patternStr] || null;
      const confidence =
        rule.priority >= 100
          ? 1.0
          : rule.priority >= 80
            ? 0.9
            : rule.priority >= 70
              ? 0.8
              : 0.7;

      return {
        categoryName,
        confidence,
        matchedPattern: patternStr,
      };
    }
  }

  return { categoryName: null, confidence: 0 };
}

/**
 * Categorize multiple transactions and return categorization preview
 */
export function categorizeTransactions(
  transactions: { description: string; amount: number }[]
): Map<
  string,
  { categoryName: string | null; confidence: number; count: number }
> {
  const results = new Map<
    string,
    { categoryName: string | null; confidence: number; count: number }
  >();

  for (const tx of transactions) {
    const result = categorizeDescription(tx.description);
    const key = result.categoryName || "Uncategorized";

    const existing = results.get(key);
    if (existing) {
      existing.count++;
    } else {
      results.set(key, {
        categoryName: result.categoryName,
        confidence: result.confidence,
        count: 1,
      });
    }
  }

  return results;
}

/**
 * Check if a transaction should be flagged for review
 * Transactions are flagged if:
 * - No category match found
 * - Confidence is below threshold
 * - Amount is unusually large
 */
export function shouldFlagForReview(
  description: string,
  amount: number,
  confidence: number,
  confidenceThreshold = 0.7,
  largeAmountThreshold = 1000
): boolean {
  // Flag if no match or low confidence
  if (confidence < confidenceThreshold) {
    return true;
  }

  // Flag large transactions for review
  if (Math.abs(amount) > largeAmountThreshold) {
    return true;
  }

  return false;
}
