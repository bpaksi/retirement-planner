/**
 * Transfer detection utility
 * Analyzes transaction descriptions to suggest potential accounts
 */

export type AccountType =
  | "checking"
  | "savings"
  | "credit_card"
  | "brokerage"
  | "401k"
  | "403b"
  | "traditional_ira"
  | "roth_ira"
  | "roth_401k"
  | "money_market"
  | "loan"
  | "other";

export interface SuggestedAccount {
  suggestedName: string;
  suggestedType: AccountType;
  suggestedInstitution: string;
  matchedPattern: string;
  frequency: number;
  exampleDescriptions: string[];
}

interface TransferPattern {
  pattern: RegExp;
  extractName: (match: RegExpMatchArray, description: string) => string;
  type: AccountType;
  institution?: string;
}

const TRANSFER_PATTERNS: TransferPattern[] = [
  // Payment services
  {
    pattern: /\bVENMO\b/i,
    extractName: () => "Venmo",
    type: "other",
    institution: "Venmo",
  },
  {
    pattern: /\bZELLE\b/i,
    extractName: () => "Zelle",
    type: "other",
    institution: "Zelle",
  },
  {
    pattern: /\bPAYPAL\b/i,
    extractName: () => "PayPal",
    type: "other",
    institution: "PayPal",
  },
  {
    pattern: /\bCASH\s*APP\b/i,
    extractName: () => "Cash App",
    type: "other",
    institution: "Cash App",
  },
  {
    pattern: /\bAPPLE\s*PAY\b/i,
    extractName: () => "Apple Pay",
    type: "other",
    institution: "Apple",
  },
  {
    pattern: /\bGOOGLE\s*PAY\b/i,
    extractName: () => "Google Pay",
    type: "other",
    institution: "Google",
  },

  // Credit card payments (often indicate credit card accounts)
  {
    pattern: /\b(CAPITAL\s*ONE)\s*(PAYMENT|PMT|AUTOPAY)/i,
    extractName: () => "Capital One Credit Card",
    type: "credit_card",
    institution: "Capital One",
  },
  {
    pattern: /\b(CHASE)\s*(PAYMENT|PMT|AUTOPAY|CREDIT\s*CARD)/i,
    extractName: () => "Chase Credit Card",
    type: "credit_card",
    institution: "Chase",
  },
  {
    pattern: /\b(AMEX|AMERICAN\s*EXPRESS)\s*(PAYMENT|PMT|AUTOPAY)/i,
    extractName: () => "American Express",
    type: "credit_card",
    institution: "American Express",
  },
  {
    pattern: /\b(DISCOVER)\s*(PAYMENT|PMT|AUTOPAY)/i,
    extractName: () => "Discover Card",
    type: "credit_card",
    institution: "Discover",
  },
  {
    pattern: /\b(CITI|CITIBANK)\s*(PAYMENT|PMT|AUTOPAY)/i,
    extractName: () => "Citi Credit Card",
    type: "credit_card",
    institution: "Citibank",
  },
  {
    pattern: /\b(BARCLAYS?)\s*(PAYMENT|PMT|AUTOPAY)/i,
    extractName: () => "Barclays Credit Card",
    type: "credit_card",
    institution: "Barclays",
  },

  // Bank transfers
  {
    pattern: /TRANSFER\s+(?:TO|FROM)\s+(\w+\s*\w*)\s*(?:SAVINGS|SAV)/i,
    extractName: (match) => `${match[1]} Savings`,
    type: "savings",
  },
  {
    pattern: /TRANSFER\s+(?:TO|FROM)\s+(\w+\s*\w*)\s*(?:CHECKING|CHK)/i,
    extractName: (match) => `${match[1]} Checking`,
    type: "checking",
  },
  {
    pattern: /TRANSFER\s+(?:TO|FROM)\s+SAVINGS/i,
    extractName: () => "Savings Account",
    type: "savings",
  },
  {
    pattern: /TRANSFER\s+(?:TO|FROM)\s+CHECKING/i,
    extractName: () => "Checking Account",
    type: "checking",
  },

  // Brokerage and investment accounts
  {
    pattern: /\b(FIDELITY)\s*(TRANSFER|CONTRIBUTION|WITHDRAWAL)/i,
    extractName: () => "Fidelity Brokerage",
    type: "brokerage",
    institution: "Fidelity",
  },
  {
    pattern: /\b(VANGUARD)\s*(TRANSFER|CONTRIBUTION|WITHDRAWAL)/i,
    extractName: () => "Vanguard Brokerage",
    type: "brokerage",
    institution: "Vanguard",
  },
  {
    pattern: /\b(SCHWAB|CHARLES\s*SCHWAB)\s*(TRANSFER|CONTRIBUTION|WITHDRAWAL)/i,
    extractName: () => "Schwab Brokerage",
    type: "brokerage",
    institution: "Charles Schwab",
  },
  {
    pattern: /\b(E\*?TRADE|ETRADE)\s*(TRANSFER|CONTRIBUTION|WITHDRAWAL)/i,
    extractName: () => "E*TRADE Brokerage",
    type: "brokerage",
    institution: "E*TRADE",
  },
  {
    pattern: /\b(ROBINHOOD)\s*(TRANSFER|DEPOSIT|WITHDRAWAL)/i,
    extractName: () => "Robinhood",
    type: "brokerage",
    institution: "Robinhood",
  },

  // Retirement accounts
  {
    pattern: /\b401\s*\(?K\)?\s*(CONTRIBUTION|TRANSFER|DEPOSIT)/i,
    extractName: () => "401(k)",
    type: "401k",
  },
  {
    pattern: /\bIRA\s*(CONTRIBUTION|TRANSFER|DEPOSIT)/i,
    extractName: () => "IRA",
    type: "traditional_ira",
  },
  {
    pattern: /\bROTH\s*(CONTRIBUTION|TRANSFER|DEPOSIT)/i,
    extractName: () => "Roth IRA",
    type: "roth_ira",
  },

  // Loan payments
  {
    pattern: /\b(MORTGAGE|MTG)\s*(PAYMENT|PMT)/i,
    extractName: () => "Mortgage",
    type: "loan",
  },
  {
    pattern: /\b(AUTO|CAR)\s*(LOAN|PMT|PAYMENT)/i,
    extractName: () => "Auto Loan",
    type: "loan",
  },
  {
    pattern: /\bSTUDENT\s*LOAN\s*(PAYMENT|PMT)?/i,
    extractName: () => "Student Loan",
    type: "loan",
  },

  // Money market
  {
    pattern: /\bMONEY\s*MARKET\s*(TRANSFER|DEPOSIT|WITHDRAWAL)?/i,
    extractName: () => "Money Market",
    type: "money_market",
  },
];

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  originalCategory?: string;
}

export interface ExistingAccount {
  name: string;
  institution: string;
  type: string;
}

/**
 * Detect potential accounts from transaction descriptions
 */
export function detectPotentialAccounts(
  transactions: ParsedTransaction[],
  existingAccounts: ExistingAccount[] = []
): SuggestedAccount[] {
  const accountMatches = new Map<
    string,
    {
      suggestion: Omit<SuggestedAccount, "frequency" | "exampleDescriptions">;
      count: number;
      examples: Set<string>;
    }
  >();

  for (const tx of transactions) {
    const description = tx.description.toUpperCase();

    for (const pattern of TRANSFER_PATTERNS) {
      const match = description.match(pattern.pattern);
      if (match) {
        const suggestedName = pattern.extractName(match, description);
        const key = `${suggestedName}-${pattern.type}`.toLowerCase();

        if (!accountMatches.has(key)) {
          accountMatches.set(key, {
            suggestion: {
              suggestedName,
              suggestedType: pattern.type,
              suggestedInstitution: pattern.institution || suggestedName,
              matchedPattern: pattern.pattern.source,
            },
            count: 0,
            examples: new Set(),
          });
        }

        const entry = accountMatches.get(key)!;
        entry.count++;
        if (entry.examples.size < 3) {
          entry.examples.add(tx.description);
        }
        break; // Only match first pattern per transaction
      }
    }
  }

  // Convert to array and filter out existing accounts
  const suggestions: SuggestedAccount[] = [];

  for (const [, entry] of accountMatches) {
    // Check if account already exists (fuzzy match on name and institution)
    const alreadyExists = existingAccounts.some((existing) => {
      const nameMatch =
        existing.name.toLowerCase().includes(entry.suggestion.suggestedName.toLowerCase()) ||
        entry.suggestion.suggestedName.toLowerCase().includes(existing.name.toLowerCase());
      const institutionMatch =
        existing.institution.toLowerCase().includes(entry.suggestion.suggestedInstitution.toLowerCase()) ||
        entry.suggestion.suggestedInstitution.toLowerCase().includes(existing.institution.toLowerCase());
      return nameMatch || institutionMatch;
    });

    if (!alreadyExists) {
      suggestions.push({
        ...entry.suggestion,
        frequency: entry.count,
        exampleDescriptions: Array.from(entry.examples),
      });
    }
  }

  // Sort by frequency (most common first)
  return suggestions.sort((a, b) => b.frequency - a.frequency);
}

/**
 * Check if a description appears to be a transfer
 */
export function isTransferDescription(description: string): boolean {
  const upperDesc = description.toUpperCase();
  return TRANSFER_PATTERNS.some((p) => p.pattern.test(upperDesc));
}
