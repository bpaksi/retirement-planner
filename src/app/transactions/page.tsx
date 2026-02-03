"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { ImportWizard } from "@/components/import/ImportWizard";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Upload,
  Flag,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  CircleSlash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { BatchCategoryAssigner } from "@/components/transactions/BatchCategoryAssigner";

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Check for import mode from URL params
  const importParam = searchParams.get("import");
  const accountIdParam = searchParams.get("accountId") as Id<"accounts"> | null;

  const [showImportWizard, setShowImportWizard] = useState(importParam === "true");
  const [importAccountId, setImportAccountId] = useState<Id<"accounts"> | undefined>(
    accountIdParam || undefined
  );
  const [page, setPage] = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState<
    Id<"accounts"> | undefined
  >();
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [showUncategorizedOnly, setShowUncategorizedOnly] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<string | null>(
    null
  );

  // Handle URL param changes
  useEffect(() => {
    if (importParam === "true") {
      setShowImportWizard(true);
      setImportAccountId(accountIdParam || undefined);
    }
  }, [importParam, accountIdParam]);

  // Clear URL params when closing import wizard
  const handleCloseImport = () => {
    setShowImportWizard(false);
    setImportAccountId(undefined);
    // Clear URL params
    if (importParam) {
      router.replace("/transactions");
    }
  };

  const pageSize = 25;

  const transactions = useQuery(api.transactions.queries.list, {
    accountId: selectedAccountId,
    flaggedOnly: showFlaggedOnly || undefined,
    uncategorizedOnly: showUncategorizedOnly || undefined,
    limit: pageSize,
    offset: page * pageSize,
  });

  const accounts = useQuery(api.accounts.queries.list, { activeOnly: true });
  const categories = useQuery(api.categories.queries.list);

  const handleCategoryUpdateComplete = (count: number) => {
    setEditingTransaction(null);
    // Could add a toast notification here showing "Updated {count} transaction(s)"
  };

  if (showImportWizard) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Import Transactions</h1>
              <Button
                variant="ghost"
                onClick={handleCloseImport}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
            <ImportWizard
              onComplete={handleCloseImport}
              defaultAccountId={importAccountId}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Transactions</h1>
              <p className="text-muted-foreground mt-1">
                View and manage your imported transactions
              </p>
            </div>
            <Button onClick={() => setShowImportWizard(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>

                <Select
                  value={selectedAccountId || ""}
                  onChange={(e) =>
                    setSelectedAccountId(
                      (e.target.value as Id<"accounts">) || undefined
                    )
                  }
                  className="w-[200px]"
                >
                  <option value="">All Accounts</option>
                  {accounts?.map((account) => (
                    <option key={account._id} value={account._id}>
                      {account.name}
                    </option>
                  ))}
                </Select>

                <Button
                  variant={showFlaggedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
                >
                  <Flag
                    className={cn(
                      "w-4 h-4 mr-2",
                      showFlaggedOnly && "fill-current"
                    )}
                  />
                  Flagged Only
                </Button>

                <Button
                  variant={showUncategorizedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowUncategorizedOnly(!showUncategorizedOnly)}
                >
                  <CircleSlash
                    className="w-4 h-4 mr-2"
                  />
                  Uncategorized
                </Button>

                {(selectedAccountId || showFlaggedOnly || showUncategorizedOnly) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedAccountId(undefined);
                      setShowFlaggedOnly(false);
                      setShowUncategorizedOnly(false);
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                {transactions?.total ?? 0} Transactions
              </CardTitle>
              {showFlaggedOnly && (
                <CardDescription>
                  Showing transactions flagged for review
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {transactions && transactions.transactions.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[150px]">Account</TableHead>
                        <TableHead className="w-[150px]">Category</TableHead>
                        <TableHead className="w-[120px] text-right">
                          Amount
                        </TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.transactions.map((tx) => (
                        <TableRow key={tx._id}>
                          <TableCell className="font-mono text-sm">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {tx.description}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {tx.account?.name || "-"}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => setEditingTransaction(tx._id)}
                              className={cn(
                                "text-sm px-2 py-1 rounded hover:bg-muted transition-colors",
                                tx.isFlagged && "text-warning",
                                !tx.category && "text-muted-foreground italic"
                              )}
                            >
                              {tx.category?.name || "Uncategorized"}
                              {tx.isFlagged && " ?"}
                            </button>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-mono",
                              tx.amount < 0
                                ? "text-destructive"
                                : "text-success"
                            )}
                          >
                            {formatCurrency(tx.amount)}
                          </TableCell>
                          <TableCell>
                            {tx.isFlagged && (
                              <Flag className="w-4 h-4 text-warning" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Showing {page * pageSize + 1} -{" "}
                      {Math.min((page + 1) * pageSize, transactions.total)} of{" "}
                      {transactions.total}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={!transactions.hasMore}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    {transactions
                      ? "No transactions found"
                      : "Loading transactions..."}
                  </p>
                  {transactions && (
                    <Button onClick={() => setShowImportWizard(true)}>
                      <Upload className="w-4 h-4 mr-2" />
                      Import your first CSV
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category Assignment Dialog */}
        {(() => {
          const editingTx = transactions?.transactions.find(
            (tx) => tx._id === editingTransaction
          );
          return (
            <Dialog
              open={!!editingTransaction && !!editingTx}
              onClose={() => setEditingTransaction(null)}
              className="max-w-[600px] p-0"
            >
              {editingTx && categories && (
                <BatchCategoryAssigner
                  transaction={editingTx}
                  categories={categories}
                  onClose={() => setEditingTransaction(null)}
                  onComplete={handleCategoryUpdateComplete}
                />
              )}
            </Dialog>
          );
        })()}
      </main>
    </div>
  );
}
