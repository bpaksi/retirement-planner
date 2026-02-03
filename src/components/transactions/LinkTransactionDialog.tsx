"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Link2, Link2Off, Check, AlertTriangle } from "lucide-react";

interface Transaction {
  _id: Id<"transactions">;
  description: string;
  amount: number;
  date: number;
  accountId: Id<"accounts">;
  linkedTransactionId?: Id<"transactions">;
  account?: { name: string } | null;
  linkedAccountName?: string | null;
}

interface LinkTransactionDialogProps {
  transaction: Transaction;
  open: boolean;
  onClose: () => void;
  onLinkComplete?: () => void;
}

export function LinkTransactionDialog({
  transaction,
  open,
  onClose,
  onLinkComplete,
}: LinkTransactionDialogProps) {
  const [selectedId, setSelectedId] = useState<Id<"transactions"> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Queries
  const potentialLinks = useQuery(
    api.transactions.linking.findPotentialLinks,
    open && !transaction.linkedTransactionId
      ? { transactionId: transaction._id }
      : "skip"
  );

  const linkedTransaction = useQuery(
    api.transactions.linking.getLinkedTransaction,
    open && transaction.linkedTransactionId
      ? { transactionId: transaction._id }
      : "skip"
  );

  // Mutations
  const linkTransactions = useMutation(api.transactions.linking.linkTransactions);
  const unlinkTransactions = useMutation(api.transactions.linking.unlinkTransactions);

  const isLinked = !!transaction.linkedTransactionId;

  const handleLink = async () => {
    if (!selectedId) return;

    setIsSubmitting(true);
    try {
      await linkTransactions({
        transactionId1: transaction._id,
        transactionId2: selectedId,
      });
      onLinkComplete?.();
      onClose();
    } catch (error) {
      console.error("Failed to link transactions:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    setIsSubmitting(true);
    try {
      await unlinkTransactions({
        transactionId: transaction._id,
      });
      onLinkComplete?.();
      onClose();
    } catch (error) {
      console.error("Failed to unlink transactions:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.9) return "Excellent match";
    if (score >= 0.7) return "Good match";
    return "Possible match";
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return "text-success";
    if (score >= 0.7) return "text-warning";
    return "text-muted-foreground";
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {isLinked ? (
            <>
              <Link2 className="w-5 h-5 text-primary" />
              Linked Transfer
            </>
          ) : (
            <>
              <Link2Off className="w-5 h-5" />
              Link Transfer
            </>
          )}
        </DialogTitle>
        <DialogDescription>
          {isLinked
            ? "This transaction is linked to a transfer in another account."
            : "Link this transaction to a matching transfer in another account."}
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        {/* Source Transaction */}
        <div className="p-3 bg-muted/30 rounded-lg border border-border mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{transaction.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {transaction.account?.name} &middot; {formatDate(transaction.date)}
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

        {/* Already Linked - Show linked transaction */}
        {isLinked && linkedTransaction && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Linked to:
            </p>
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {linkedTransaction.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {linkedTransaction.account?.name} &middot;{" "}
                    {formatDate(linkedTransaction.date)}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-sm font-mono font-medium flex-shrink-0",
                    linkedTransaction.amount < 0 ? "text-destructive" : "text-success"
                  )}
                >
                  {formatCurrency(linkedTransaction.amount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Not Linked - Show potential matches */}
        {!isLinked && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Potential matches:
            </p>

            {potentialLinks === undefined ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Searching for matches...
              </div>
            ) : potentialLinks.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">
                  No matching transactions found
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Matches require opposite amount, different account, and similar date
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {potentialLinks.map((match) => (
                  <button
                    key={match._id}
                    onClick={() => setSelectedId(match._id as Id<"transactions">)}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left transition-colors",
                      selectedId === match._id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {match.description}
                          </p>
                          {selectedId === match._id && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {match.accountName} &middot; {formatDate(match.date)}
                        </p>
                        <p className={cn("text-xs mt-1", getScoreColor(match.score))}>
                          {getScoreLabel(match.score)} ({Math.round(match.score * 100)}%)
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-mono font-medium flex-shrink-0",
                          match.amount < 0 ? "text-destructive" : "text-success"
                        )}
                      >
                        {formatCurrency(match.amount)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        {isLinked ? (
          <Button
            variant="destructive"
            onClick={handleUnlink}
            disabled={isSubmitting}
          >
            <Link2Off className="w-4 h-4 mr-2" />
            {isSubmitting ? "Unlinking..." : "Unlink Transfer"}
          </Button>
        ) : (
          <Button
            onClick={handleLink}
            disabled={!selectedId || isSubmitting}
          >
            <Link2 className="w-4 h-4 mr-2" />
            {isSubmitting ? "Linking..." : "Link Transactions"}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
