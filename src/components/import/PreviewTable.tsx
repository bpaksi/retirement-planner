"use client";

import { ParsedTransaction } from "@/lib/csv-parsers/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { categorizeDescription } from "@/lib/categorization";

interface PreviewTableProps {
  transactions: ParsedTransaction[];
  maxRows?: number;
}

export function PreviewTable({
  transactions,
  maxRows = 10,
}: PreviewTableProps) {
  const displayTransactions = transactions.slice(0, maxRows);
  const hasMore = transactions.length > maxRows;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[140px]">Category (Preview)</TableHead>
            <TableHead className="w-[120px] text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayTransactions.map((tx, index) => {
            const { categoryName, confidence } = categorizeDescription(
              tx.description
            );
            const isLowConfidence = confidence < 0.8;

            return (
              <TableRow key={index}>
                <TableCell className="font-mono text-sm">
                  {formatDate(tx.date.getTime())}
                </TableCell>
                <TableCell className="max-w-[300px] truncate">
                  {tx.description}
                </TableCell>
                <TableCell>
                  <span
                    className={
                      isLowConfidence
                        ? "text-warning"
                        : "text-muted-foreground"
                    }
                  >
                    {categoryName || "Uncategorized"}
                    {isLowConfidence && " ?"}
                  </span>
                </TableCell>
                <TableCell
                  className={`text-right font-mono ${
                    tx.amount < 0 ? "text-destructive" : "text-success"
                  }`}
                >
                  {formatCurrency(tx.amount)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {hasMore && (
        <div className="px-4 py-3 bg-muted/30 text-sm text-muted-foreground text-center border-t border-border">
          Showing {maxRows} of {transactions.length} transactions
        </div>
      )}
    </div>
  );
}
