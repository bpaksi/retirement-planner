"use client";

import { Id } from "../../../convex/_generated/dataModel";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface SimilarTransaction {
  _id: Id<"transactions">;
  description: string;
  amount: number;
  date: number;
  similarityScore: number;
  matchLevel: "strong" | "good" | "weak";
  account?: { name: string } | null;
}

interface SimilarTransactionsListProps {
  transactions: SimilarTransaction[] | undefined;
  selectedIds: Set<Id<"transactions">>;
  onToggle: (id: Id<"transactions">) => void;
  onToggleAll: () => void;
  isLoading: boolean;
}

function SimilaritySkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 animate-pulse"
        >
          <div className="w-4 h-4 mt-0.5 rounded bg-muted-foreground/20" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-muted-foreground/20" />
            <div className="h-3 w-1/2 rounded bg-muted-foreground/20" />
          </div>
          <div className="h-4 w-16 rounded bg-muted-foreground/20" />
        </div>
      ))}
    </div>
  );
}

function SimilarityBar({ level }: { level: "strong" | "good" | "weak" }) {
  const segments = level === "strong" ? 8 : level === "good" ? 6 : 4;
  const label =
    level === "strong"
      ? "strong match"
      : level === "good"
        ? "good match"
        : "weak match";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 h-2 rounded-sm transition-colors",
              i < segments
                ? level === "strong"
                  ? "bg-emerald-500"
                  : level === "good"
                    ? "bg-amber-500"
                    : "bg-orange-400"
                : "bg-muted-foreground/20"
            )}
          />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

function TransactionCheckbox({
  transaction,
  isSelected,
  onToggle,
}: {
  transaction: SimilarTransaction;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-start gap-3 w-full p-3 rounded-lg text-left transition-all",
        "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "bg-accent/40"
      )}
    >
      {/* Checkbox */}
      <div
        className={cn(
          "flex items-center justify-center w-4 h-4 mt-0.5 rounded border transition-colors flex-shrink-0",
          isSelected
            ? "bg-primary border-primary text-primary-foreground"
            : "border-muted-foreground/40 bg-transparent"
        )}
      >
        {isSelected && <Check className="w-3 h-3" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span
            className="text-sm font-medium truncate"
            title={transaction.description}
          >
            {transaction.description}
          </span>
          <span
            className={cn(
              "text-sm font-mono flex-shrink-0",
              transaction.amount < 0 ? "text-destructive" : "text-success"
            )}
          >
            {formatCurrency(transaction.amount)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {formatDate(transaction.date)}
            {transaction.account?.name && ` · ${transaction.account.name}`}
          </span>
          <SimilarityBar level={transaction.matchLevel} />
        </div>
      </div>
    </button>
  );
}

export function SimilarTransactionsList({
  transactions,
  selectedIds,
  onToggle,
  onToggleAll,
  isLoading,
}: SimilarTransactionsListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-1 pb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Also Apply To
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <SimilaritySkeleton />
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return null;
  }

  const allSelected =
    transactions.length > 0 &&
    transactions.every((t) => selectedIds.has(t._id));
  const someSelected = transactions.some((t) => selectedIds.has(t._id));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Also Apply To
        </h3>
        <button
          onClick={onToggleAll}
          className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {allSelected ? "Deselect all" : someSelected ? "Select all" : "Select all"}
        </button>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
        {transactions.map((transaction) => (
          <TransactionCheckbox
            key={transaction._id}
            transaction={transaction}
            isSelected={selectedIds.has(transaction._id)}
            onToggle={() => onToggle(transaction._id)}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="pt-3 mt-auto border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          {selectedIds.size} of {transactions.length} similar transaction
          {transactions.length !== 1 ? "s" : ""} selected
        </p>
      </div>
    </div>
  );
}
