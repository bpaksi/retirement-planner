import { parse } from "date-fns";
import { CSVParser, ParsedTransaction } from "./types";

/**
 * Parser for Edward Jones activity CSV exports
 * Expected columns: DATE, ACTIVITY, DESCRIPTION, QUANTITY, PRICE, AMOUNT, ACCOUNT NICKNAME
 */
export const edwardJonesParser: CSVParser = {
  name: "edward_jones",
  institution: "Edward Jones",

  detect: (headers: string[]) => {
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
    // Edward Jones has these specific columns
    const indicators = ["date", "activity", "description", "amount"];
    const matchCount = indicators.filter((ind) =>
      normalizedHeaders.some((h) => h.includes(ind))
    ).length;
    // Need at least 3 of the 4 indicators
    return matchCount >= 3;
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

      const dateStr = getColumn("DATE");
      if (!dateStr) return null;

      // Edward Jones uses MM/dd/yyyy format
      const date = parse(dateStr, "MM/dd/yyyy", new Date());
      if (isNaN(date.getTime())) return null;

      // Build description from ACTIVITY and DESCRIPTION fields
      const activity = getColumn("ACTIVITY");
      const description = getColumn("DESCRIPTION");
      const fullDescription = description
        ? `${activity}: ${description}`
        : activity;

      if (!fullDescription) return null;

      // Parse amount - handles formats like "$1,234.56" or "-$1,234.56"
      const amountStr = getColumn("AMOUNT");
      if (!amountStr) return null;

      const amount = parseFloat(amountStr.replace(/[$,]/g, ""));
      if (isNaN(amount)) return null;

      return {
        date,
        description: fullDescription,
        amount,
        originalCategory: activity,
        originalRow: row,
      };
    } catch (e) {
      console.error("Failed to parse Edward Jones row:", e);
      return null;
    }
  },
};
