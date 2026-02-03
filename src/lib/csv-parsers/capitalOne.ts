import { parse } from "date-fns";
import { CSVParser, ParsedTransaction } from "./types";

/**
 * Parser for Capital One credit card CSV exports
 * Expected columns: Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit
 */
export const capitalOneParser: CSVParser = {
  name: "capital_one",
  institution: "Capital One",

  detect: (headers: string[]) => {
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
    const required = ["transaction date", "description", "debit", "credit"];
    return required.every((r) =>
      normalizedHeaders.some((h) => h.includes(r.toLowerCase()))
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

      const dateStr =
        getColumn("Transaction Date") || getColumn("Posted Date");
      if (!dateStr) return null;

      // Capital One uses yyyy-MM-dd format
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      if (isNaN(date.getTime())) return null;

      const description = getColumn("Description");
      if (!description) return null;

      // Handle debit (expense) and credit (payment/refund)
      const debitStr = getColumn("Debit");
      const creditStr = getColumn("Credit");

      const debit = parseFloat(debitStr?.replace(/[,$]/g, "") || "0");
      const credit = parseFloat(creditStr?.replace(/[,$]/g, "") || "0");

      // Debit is expense (negative), Credit is income (positive)
      const amount = credit > 0 ? credit : -debit;

      // Skip rows with no amount
      if (amount === 0) return null;

      return {
        date,
        description,
        amount,
        originalCategory: getColumn("Category"),
        originalRow: row,
      };
    } catch (e) {
      console.error("Failed to parse Capital One row:", e);
      return null;
    }
  },
};
