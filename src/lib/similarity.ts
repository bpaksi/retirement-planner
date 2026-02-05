/**
 * Transaction similarity scoring utilities
 *
 * Used to find similar transactions for batch categorization.
 * Scores range from 0-1, with higher scores indicating stronger similarity.
 */

// Known merchant name variations for pattern matching
const MERCHANT_ALIASES: Record<string, string[]> = {
  amazon: ["amzn", "amazon", "amz*", "amzn mktp"],
  walmart: ["walmart", "wal-mart", "wm supercenter"],
  target: ["target", "tgt"],
  starbucks: ["starbucks", "sbux"],
  costco: ["costco", "costco whse"],
  kroger: ["kroger", "krog"],
  mcdonalds: ["mcdonald", "mcdonalds", "mcd"],
  shell: ["shell", "shell oil"],
  chevron: ["chevron", "chevron usa"],
  exxon: ["exxon", "exxonmobil"],
  walgreens: ["walgreens", "walgreen"],
  cvs: ["cvs", "cvs pharmacy", "cvs/pharmacy"],
  home_depot: ["home depot", "the home depot", "homedepot"],
  lowes: ["lowes", "lowe's"],
  trader_joes: ["trader joe", "trader joes", "traderjoe"],
  whole_foods: ["whole foods", "wholefoods", "whole fds"],
  publix: ["publix", "publix super"],
  safeway: ["safeway", "safeway store"],
  aldi: ["aldi", "aldi foods"],
};

/**
 * Gets the first significant word (>3 chars) from a transaction description.
 * This is often the merchant name or primary identifier.
 */
export function getFirstSignificantWord(description: string): string | null {
  const words = description
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  return words[0] || null;
}

/**
 * Gets all significant words (>2 chars) from a description.
 * Used for calculating word overlap similarity.
 */
export function getSignificantWords(description: string): Set<string> {
  const words = description
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(words);
}

/**
 * Checks if two descriptions match known merchant patterns.
 * Returns true if both descriptions refer to the same merchant.
 */
export function matchesMerchantPattern(desc1: string, desc2: string): boolean {
  const normalized1 = desc1.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const normalized2 = desc2.toLowerCase().replace(/[^a-z0-9\s]/g, " ");

  for (const aliases of Object.values(MERCHANT_ALIASES)) {
    const matches1 = aliases.some((alias) => normalized1.includes(alias));
    const matches2 = aliases.some((alias) => normalized2.includes(alias));

    if (matches1 && matches2) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates Jaccard similarity between two sets of words.
 * Returns intersection size / union size (0-1).
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 0;

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Calculates amount similarity between two transaction amounts.
 * Uses different thresholds for small vs large amounts.
 *
 * - For amounts < $100: considers within 10% as similar
 * - For amounts >= $100: considers within 5% as similar
 */
function amountSimilarity(amount1: number, amount2: number): number {
  // Use absolute values for comparison (both expenses and income)
  const abs1 = Math.abs(amount1);
  const abs2 = Math.abs(amount2);

  // Must be same sign (both expenses or both income)
  if ((amount1 < 0) !== (amount2 < 0)) {
    return 0;
  }

  const max = Math.max(abs1, abs2);
  const min = Math.min(abs1, abs2);

  if (max === 0) return 1;

  const diff = (max - min) / max;

  // Different thresholds based on amount size
  const threshold = max < 100 ? 0.1 : 0.05;

  if (diff <= threshold) {
    // Perfect or near-perfect match
    return 1;
  } else if (diff <= threshold * 2) {
    // Close match - linear falloff
    return 1 - (diff - threshold) / threshold;
  } else if (diff <= threshold * 4) {
    // Moderate match
    return 0.5 * (1 - (diff - threshold * 2) / (threshold * 2));
  }

  return 0;
}

interface Transaction {
  description: string;
  amount: number;
}

/**
 * Calculates overall similarity score between two transactions.
 *
 * Weights:
 * - First word match: 40%
 * - Word overlap (Jaccard): 30%
 * - Amount similarity: 20%
 * - Merchant pattern: 10%
 */
export function calculateSimilarityScore(
  target: Transaction,
  candidate: Transaction
): number {
  const WEIGHTS = {
    firstWord: 0.4,
    wordOverlap: 0.3,
    amount: 0.2,
    merchantPattern: 0.1,
  };

  let score = 0;

  // First word match (40%)
  const targetFirst = getFirstSignificantWord(target.description);
  const candidateFirst = getFirstSignificantWord(candidate.description);
  if (targetFirst && candidateFirst && targetFirst === candidateFirst) {
    score += WEIGHTS.firstWord;
  }

  // Word overlap - Jaccard similarity (30%)
  const targetWords = getSignificantWords(target.description);
  const candidateWords = getSignificantWords(candidate.description);
  const jaccard = jaccardSimilarity(targetWords, candidateWords);
  score += WEIGHTS.wordOverlap * jaccard;

  // Amount similarity (20%)
  const amtSim = amountSimilarity(target.amount, candidate.amount);
  score += WEIGHTS.amount * amtSim;

  // Merchant pattern match (10%)
  if (matchesMerchantPattern(target.description, candidate.description)) {
    score += WEIGHTS.merchantPattern;
  }

  return score;
}

/**
 * Classifies a similarity score into a match level.
 */
export function getMatchLevel(
  score: number
): "strong" | "good" | "weak" | "none" {
  if (score >= 0.7) return "strong";
  if (score >= 0.5) return "good";
  if (score >= 0.4) return "weak";
  return "none";
}
