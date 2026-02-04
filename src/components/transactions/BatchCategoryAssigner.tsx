"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { CategoryPicker } from "./CategoryPicker";
import { SimilarTransactionsList } from "./SimilarTransactionsList";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { X, ArrowRight } from "lucide-react";

interface Category {
  _id: Id<"categories">;
  name: string;
  type: "expense" | "income" | "transfer";
  isEssential: boolean;
  color: string;
}

interface Transaction {
  _id: Id<"transactions">;
  description: string;
  amount: number;
  date: number;
  categoryId?: Id<"categories"> | null;
  category?: { name: string; color: string } | null;
}

interface BatchCategoryAssignerProps {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
  onComplete: (count: number) => void;
}

export function BatchCategoryAssigner({
  transaction,
  categories,
  onClose,
  onComplete,
}: BatchCategoryAssignerProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    Id<"categories"> | undefined
  >(transaction.categoryId || undefined);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"transactions">>>(
    new Set()
  );
  const hasInitializedSelection = useRef(false);

  // Query similar transactions
  const similarTransactions = useQuery(api.transactions.queries.findSimilar, {
    transactionId: transaction._id,
    limit: 10,
  });

  // Mutations
  const updateCategory = useMutation(api.transactions.mutations.updateCategory);
  const bulkUpdateCategory = useMutation(
    api.transactions.mutations.bulkUpdateCategory
  );

  // Pre-select high-confidence matches when query returns (only once)
  // This is a valid pattern for initializing state from async query results
  useEffect(() => {
    if (similarTransactions && !hasInitializedSelection.current) {
      hasInitializedSelection.current = true;
      const highConfidence = similarTransactions
        .filter((t) => t.similarityScore >= 0.6)
        .map((t) => t._id);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIds(new Set(highConfidence));
    }
  }, [similarTransactions]);

  const handleToggle = useCallback((id: Id<"transactions">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (!similarTransactions) return;

    const allSelected = similarTransactions.every((t) => selectedIds.has(t._id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(similarTransactions.map((t) => t._id)));
    }
  }, [similarTransactions, selectedIds]);

  const handleApply = async () => {
    if (!selectedCategoryId) return;

    const totalCount = 1 + selectedIds.size;

    try {
      // Update the main transaction
      await updateCategory({
        id: transaction._id,
        categoryId: selectedCategoryId,
        unflag: true,
      });

      // Update similar transactions if any selected
      if (selectedIds.size > 0) {
        await bulkUpdateCategory({
          ids: Array.from(selectedIds),
          categoryId: selectedCategoryId,
          unflag: true,
        });
      }

      onComplete(totalCount);
    } catch (error) {
      console.error("Failed to update categories:", error);
    }
  };

  const totalSelected = 1 + selectedIds.size;
  const isLoading = similarTransactions === undefined;
  const hasSimilar =
    similarTransactions && similarTransactions.length > 0;

  // Determine layout: single column if no similar transactions
  const showTwoColumns = isLoading || hasSimilar;

  return (
    <div
      className="flex flex-col"
      role="dialog"
      aria-labelledby="batch-assigner-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2
          id="batch-assigner-title"
          className="text-sm font-semibold"
        >
          Categorize Transaction
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Target transaction display */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="font-medium text-sm truncate"
              title={transaction.description}
            >
              {transaction.description}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(transaction.date)}
            </p>
          </div>
          <span
            className={cn(
              "text-sm font-mono font-medium flex-shrink-0",
              transaction.amount < 0 ? "text-destructive" : "text-success"
            )}
          >
            {formatCurrency(transaction.amount)}
          </span>
        </div>
      </div>

      {/* Main content - two panel or single panel */}
      <div
        className={cn(
          "flex-1 min-h-0",
          showTwoColumns ? "grid grid-cols-2 divide-x divide-border" : ""
        )}
      >
        {/* Left panel - Category picker */}
        <div
          className={cn(
            "flex flex-col p-4",
            showTwoColumns ? "" : "w-full"
          )}
        >
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-3">
            Choose Category
          </h3>
          <div className="flex-1 overflow-y-auto -mx-1">
            <CategoryPicker
              categories={categories}
              selectedId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
            />
          </div>
        </div>

        {/* Right panel - Similar transactions */}
        {showTwoColumns && (
          <div className="flex flex-col p-4 min-h-[280px]">
            <SimilarTransactionsList
              transactions={similarTransactions}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/20">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!selectedCategoryId}
          className="min-w-[140px]"
        >
          {!selectedCategoryId ? (
            "Select a category"
          ) : (
            <>
              Apply to {totalSelected} transaction{totalSelected !== 1 ? "s" : ""}
              {totalSelected > 1 && <ArrowRight className="w-3.5 h-3.5 ml-1.5" />}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
