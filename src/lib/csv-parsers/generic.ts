import { parse } from "date-fns";
import { ParsedTransaction, ColumnMapping } from "./types";

// Common date formats to try
const DATE_FORMATS = [
  "yyyy-MM-dd",
  "MM/dd/yyyy",
  "M/d/yyyy",
  "MM-dd-yyyy",
  "dd/MM/yyyy",
  "M/d/yy",
  "MM/dd/yy",
];

/**
 * Parse a date string trying multiple formats
 */
export function parseFlexibleDate(str: string): Date | null {
  if (!str) return null;

  // Clean the string
  const cleaned = str.trim();

  // Try each format
  for (const fmt of DATE_FORMATS) {
    try {
      const date = parse(cleaned, fmt, new Date());
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch {
      // Continue to next format
    }
  }

  // Try native Date parsing as fallback
  const native = new Date(cleaned);
  return isNaN(native.getTime()) ? null : native;
}

/**
 * Parse an amount string handling various formats
 * Formats: "1,234.56", "$1,234.56", "(1,234.56)", "-1234.56", "-$1,234.56"
 */
export function parseAmount(str: string): number {
  if (!str) return 0;

  // Check for parentheses (negative in accounting format)
  const isNegative = str.includes("(") && str.includes(")");

  // Clean the string
  let cleaned = str
    .replace(/[$,]/g, "")
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .trim();

  const value = parseFloat(cleaned);

  if (isNaN(value)) return 0;

  return isNegative ? -Math.abs(value) : value;
}

/**
 * Parse transactions with a custom column mapping
 */
export function parseWithCustomMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): { transactions: ParsedTransaction[]; errors: string[] } {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for header row and 1-based indexing

    try {
      // Parse date
      const dateStr = row[mapping.date];
      const date = parseFlexibleDate(dateStr);
      if (!date) {
        errors.push(`Row ${rowNum}: Invalid date "${dateStr}"`);
        continue;
      }

      // Get description
      const description = row[mapping.description];
      if (!description) {
        errors.push(`Row ${rowNum}: Missing description`);
        continue;
      }

      // Parse amount
      let amount: number;

      if (mapping.amount) {
        // Single amount column
        amount = parseAmount(row[mapping.amount]);
      } else if (mapping.debit && mapping.credit) {
        // Separate debit/credit columns
        const debit = parseAmount(row[mapping.debit] || "0");
        const credit = parseAmount(row[mapping.credit] || "0");
        // Credit is positive (income), debit is negative (expense)
        amount = credit > 0 ? Math.abs(credit) : -Math.abs(debit);
      } else {
        errors.push(`Row ${rowNum}: No amount mapping configured`);
        continue;
      }

      // Skip zero-amount rows
      if (amount === 0) {
        continue;
      }

      transactions.push({
        date,
        description: description.trim(),
        amount,
        originalRow: row,
      });
    } catch (e) {
      errors.push(`Row ${rowNum}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  return { transactions, errors };
}

/**
 * Auto-detect likely column mappings from headers
 */
export function suggestColumnMapping(
  headers: string[]
): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};

  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: h.toLowerCase().trim(),
  }));

  // Find date column
  const datePatterns = ["date", "trans date", "transaction date", "posted"];
  for (const pattern of datePatterns) {
    const match = normalizedHeaders.find((h) => h.normalized.includes(pattern));
    if (match) {
      mapping.date = match.original;
      break;
    }
  }

  // Find description column
  const descPatterns = ["description", "desc", "memo", "name", "payee", "merchant"];
  for (const pattern of descPatterns) {
    const match = normalizedHeaders.find((h) => h.normalized.includes(pattern));
    if (match) {
      mapping.description = match.original;
      break;
    }
  }

  // Find amount column(s)
  const amountMatch = normalizedHeaders.find(
    (h) =>
      h.normalized === "amount" ||
      h.normalized.includes("amount") ||
      h.normalized === "value"
  );
  if (amountMatch) {
    mapping.amount = amountMatch.original;
  } else {
    // Look for debit/credit columns
    const debitMatch = normalizedHeaders.find(
      (h) =>
        h.normalized.includes("debit") ||
        h.normalized.includes("withdrawal") ||
        h.normalized.includes("expense")
    );
    const creditMatch = normalizedHeaders.find(
      (h) =>
        h.normalized.includes("credit") ||
        h.normalized.includes("deposit") ||
        h.normalized.includes("income")
    );

    if (debitMatch) mapping.debit = debitMatch.original;
    if (creditMatch) mapping.credit = creditMatch.original;
  }

  return mapping;
}
