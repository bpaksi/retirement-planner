import { parse } from "date-fns";
import { CSVParser, ParsedTransaction } from "./types";

/**
 * Parser for US Bank loan CSV exports
 * Expected columns: Date, Transaction, Name, Memo, Amount
 */
export const usBankParser: CSVParser = {
  name: "usbank_loan",
  institution: "US Bank",

  detect: (headers: string[]) => {
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
    // US Bank loan has these specific columns
    return (
      normalizedHeaders.includes("date") &&
      normalizedHeaders.includes("transaction") &&
      normalizedHeaders.includes("name") &&
      normalizedHeaders.includes("amount")
    );
  },

  parse: (row: Record<string, string>): ParsedTransaction | null => {
    try {
      // Handle different case variations in column names
      const getColumn = (name: string): string => {
        const key = Object.keys(row).find(
          (k) => k.toLowerCase().trim() === name.toLowerCase()
        );
        return key ? row[key] : "";
      };

      const dateStr = getColumn("Date");
      if (!dateStr) return null;

      // US Bank uses yyyy-MM-dd format
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      if (isNaN(date.getTime())) return null;

      // Build description from Name field, removing leading "$ " if present
      const name = getColumn("Name")?.replace(/^\$\s*/, "").trim() || "Unknown";
      const transaction = getColumn("Transaction")?.trim();

      // Use name as primary description, transaction type as category
      const description = name || "Unknown";

      // Parse amount - US Bank provides positive values for credits (payments)
      const amountStr = getColumn("Amount");
      if (!amountStr) return null;

      const amount = Math.abs(parseFloat(amountStr.replace(/[$,]/g, "")));
      if (isNaN(amount)) return null;

      return {
        date,
        description,
        amount, // Raw positive - import mutation adjusts for account type
        originalCategory: transaction, // CREDIT, DEBIT, etc.
        originalRow: row,
      };
    } catch (e) {
      console.error("Failed to parse US Bank row:", e);
      return null;
    }
  },
};
