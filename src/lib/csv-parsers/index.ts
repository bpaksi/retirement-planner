import Papa from "papaparse";
import { capitalOneParser } from "./capitalOne";
import { edwardJonesParser } from "./edwardJones";
import { suggestColumnMapping, parseWithCustomMapping } from "./generic";
import { CSVParser, ParsedTransaction, ColumnMapping, ParseResult } from "./types";

// Register all available parsers
const PARSERS: CSVParser[] = [capitalOneParser, edwardJonesParser];

/**
 * Parse a CSV file, auto-detecting the format if possible
 */
export async function parseCSVFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as Record<string, string>[];
        const errors: string[] = [];

        // Check for parsing errors
        if (results.errors.length > 0) {
          results.errors.forEach((e) => {
            errors.push(`Row ${e.row}: ${e.message}`);
          });
        }

        // Try to detect parser
        const parser = PARSERS.find((p) => p.detect(headers));

        // Parse transactions if parser found
        const transactions: ParsedTransaction[] = [];
        if (parser) {
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
              const parsed = parser.parse(row);
              if (parsed) {
                transactions.push(parsed);
              }
            } catch (e) {
              errors.push(
                `Row ${i + 2}: ${e instanceof Error ? e.message : "Parse error"}`
              );
            }
          }
        }

        resolve({ parser: parser ?? null, headers, rows, transactions, errors });
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}

/**
 * Parse CSV content string
 */
export function parseCSVString(content: string): {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
} {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = [];
  if (result.errors.length > 0) {
    result.errors.forEach((e) => {
      errors.push(`Row ${e.row}: ${e.message}`);
    });
  }

  return {
    headers: result.meta.fields || [],
    rows: result.data as Record<string, string>[],
    errors,
  };
}

/**
 * Get list of available parsers
 */
export function getAvailableParsers(): { name: string; institution: string }[] {
  return PARSERS.map((p) => ({ name: p.name, institution: p.institution }));
}

/**
 * Detect which parser (if any) matches the headers
 */
export function detectParser(
  headers: string[]
): { name: string; institution: string } | null {
  const parser = PARSERS.find((p) => p.detect(headers));
  return parser ? { name: parser.name, institution: parser.institution } : null;
}

// Re-export types and utilities
export type { CSVParser, ParsedTransaction, ColumnMapping, ParseResult };
export { suggestColumnMapping, parseWithCustomMapping };
export { capitalOneParser } from "./capitalOne";
export { edwardJonesParser } from "./edwardJones";
