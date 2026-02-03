export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  originalCategory?: string;
  originalRow: Record<string, string>;
}

export interface CSVParser {
  name: string;
  institution: string;
  detect: (headers: string[]) => boolean;
  parse: (row: Record<string, string>) => ParsedTransaction | null;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
}

export interface ParseResult {
  parser: CSVParser | null;
  headers: string[];
  rows: Record<string, string>[];
  transactions: ParsedTransaction[];
  errors: string[];
}
