"use client";

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  fetchTransactions,
  fetchAccounts,
  fetchCategories,
} from "@/app/actions/data";
import type { ListTransactionsArgs } from "@/db/queries/transactions";
import type { Account } from "@/db/queries/accounts";
import type { Category } from "@/db/queries/categories";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { ImportWizard } from "@/components/import/ImportWizard";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  MultiSelectPopover,
  MultiSelectOption,
} from "@/components/ui/MultiSelectPopover";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Upload,
  Flag,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  CircleSlash,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Link2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { BatchCategoryAssigner } from "@/components/transactions/BatchCategoryAssigner";
import { LinkStatusIndicator } from "@/components/transactions/LinkStatusIndicator";
import { LinkTransactionDialog } from "@/components/transactions/LinkTransactionDialog";
import { useDebounce } from "@/hooks/useDebounce";

// Account type groupings for the multi-select
type AccountType =
  | "401k"
  | "403b"
  | "traditional_ira"
  | "roth_ira"
  | "roth_401k"
  | "brokerage"
  | "checking"
  | "savings"
  | "money_market"
  | "credit_card"
  | "loan"
  | "mortgage"
  | "other";

const ACCOUNT_TYPE_GROUPS: { label: string; types: AccountType[] }[] = [
  {
    label: "Investment",
    types: ["401k", "403b", "traditional_ira", "roth_ira", "roth_401k", "brokerage"],
  },
  {
    label: "Cash & Banking",
    types: ["checking", "savings", "money_market", "credit_card"],
  },
  {
    label: "Loans",
    types: ["loan", "mortgage"],
  },
  {
    label: "Other",
    types: ["other"],
  },
];

// Status filter options
type StatusFilter = "flagged" | "uncategorized" | "linked";

const STATUS_OPTIONS: MultiSelectOption<StatusFilter>[] = [
  {
    value: "flagged",
    label: "Flagged",
    icon: <Flag className="w-4 h-4" />,
  },
  {
    value: "uncategorized",
    label: "Uncategorized",
    icon: <CircleSlash className="w-4 h-4" />,
  },
  {
    value: "linked",
    label: "Linked",
    icon: <Link2 className="w-4 h-4" />,
  },
];

// Type for transaction data from the query
type TransactionData = Awaited<ReturnType<typeof fetchTransactions>>;

function TransactionsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Check for import mode from URL params
  const importParam = searchParams.get("import");
  const accountIdParam = searchParams.get("accountId");

  // Date range and category from URL params
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const categoryIdParamRaw = searchParams.get("category");

  // Check for special status filter values in category param
  const isStatusFilter = (val: string | null): val is StatusFilter =>
    val === "uncategorized" || val === "flagged" || val === "linked";
  const statusFromParam = isStatusFilter(categoryIdParamRaw) ? categoryIdParamRaw : null;

  // Validate category ID looks like a valid UUID (not a word like "uncategorized")
  const isValidUUID = (id: string | null): id is string =>
    id !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const categoryIdParam = isValidUUID(categoryIdParamRaw)
    ? categoryIdParamRaw
    : null;

  const [showImportWizard, setShowImportWizard] = useState(importParam === "true");
  const [importAccountId, setImportAccountId] = useState<string | undefined>(
    accountIdParam || undefined
  );
  const [page, setPage] = useState(0);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // Initialize status filter from URL param if present
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilter[]>(
    statusFromParam ? [statusFromParam] : []
  );
  const [editingTransaction, setEditingTransaction] = useState<string | null>(
    null
  );
  const [linkingTransaction, setLinkingTransaction] = useState<string | null>(
    null
  );
  const [sortBy, setSortBy] = useState<"date" | "amount" | "category">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // Data state
  const [transactions, setTransactions] = useState<TransactionData | null>(null);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Debounce search query for performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Parse date range from URL params
  const dateRange: DateRange | undefined = useMemo(() => {
    if (!startDateParam && !endDateParam) return undefined;
    return {
      from: startDateParam ? parseISO(startDateParam) : undefined,
      to: endDateParam ? parseISO(endDateParam) : undefined,
    };
  }, [startDateParam, endDateParam]);

  // Filter category ID from URL (separate from multi-select)
  const filterCategoryId = categoryIdParam || undefined;

  // Track previous values for URL sync to avoid cascading renders
  const prevImportParam = useRef(importParam);
  const prevStatusFromParam = useRef(statusFromParam);

  // Handle URL param changes - only when params actually change
  // This is a valid pattern for syncing URL state to component state
  useEffect(() => {
    if (importParam !== prevImportParam.current) {
      prevImportParam.current = importParam;
      if (importParam === "true") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowImportWizard(true);
        setImportAccountId(accountIdParam || undefined);
      }
    }
  }, [importParam, accountIdParam]);

  // Sync status filter from URL param when it changes
  // This is a valid pattern for syncing URL state to component state
  useEffect(() => {
    if (statusFromParam !== prevStatusFromParam.current) {
      prevStatusFromParam.current = statusFromParam;
      if (statusFromParam && !selectedStatuses.includes(statusFromParam)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedStatuses((prev) =>
          prev.includes(statusFromParam) ? prev : [...prev, statusFromParam]
        );
      }
    }
  }, [statusFromParam, selectedStatuses]);

  // Update URL with filter params
  const updateUrlParams = (params: {
    startDate?: string | null;
    endDate?: string | null;
    category?: string | null;
  }) => {
    const newParams = new URLSearchParams(searchParams.toString());

    if (params.startDate !== undefined) {
      if (params.startDate) {
        newParams.set("startDate", params.startDate);
      } else {
        newParams.delete("startDate");
      }
    }
    if (params.endDate !== undefined) {
      if (params.endDate) {
        newParams.set("endDate", params.endDate);
      } else {
        newParams.delete("endDate");
      }
    }
    if (params.category !== undefined) {
      if (params.category) {
        newParams.set("category", params.category);
      } else {
        newParams.delete("category");
      }
    }

    const queryString = newParams.toString();
    router.replace(`/transactions${queryString ? `?${queryString}` : ""}`);
  };

  // Handle date range change
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setPage(0);
    if (!range) {
      updateUrlParams({ startDate: null, endDate: null });
    } else {
      updateUrlParams({
        startDate: range.from ? format(range.from, "yyyy-MM-dd") : null,
        endDate: range.to ? format(range.to, "yyyy-MM-dd") : null,
      });
    }
  };

  // Clear category filter from URL
  const clearCategoryFilter = () => {
    updateUrlParams({ category: null });
    setPage(0);
  };

  // Clear all URL-based filters
  const clearAllUrlFilters = () => {
    updateUrlParams({ startDate: null, endDate: null, category: null });
    setPage(0);
  };

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

  // Convert date range to timestamps for query
  const startDateTimestamp = dateRange?.from
    ? startOfDay(dateRange.from).getTime()
    : undefined;
  const endDateTimestamp = dateRange?.to
    ? endOfDay(dateRange.to).getTime()
    : undefined;

  // Extract status filter flags
  const showFlaggedOnly = selectedStatuses.includes("flagged");
  const showUncategorizedOnly = selectedStatuses.includes("uncategorized");
  const showLinkedOnly = selectedStatuses.includes("linked");

  // Load accounts and categories on mount
  useEffect(() => {
    const loadStaticData = async () => {
      const [accountsData, categoriesData] = await Promise.all([
        fetchAccounts(true),
        fetchCategories(),
      ]);
      setAccounts(accountsData);
      setCategories(categoriesData);
    };
    loadStaticData();
  }, []);

  // Load transactions when filters change
  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    const args: ListTransactionsArgs = {
      accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
      flaggedOnly: showFlaggedOnly || undefined,
      uncategorizedOnly: showUncategorizedOnly || undefined,
      linkedOnly: showLinkedOnly || undefined,
      searchQuery: debouncedSearchQuery || undefined,
      categoryId: filterCategoryId,
      categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
      startDate: startDateTimestamp,
      endDate: endDateTimestamp,
      limit: pageSize,
      offset: page * pageSize,
      sortBy,
      sortOrder,
    };
    const data = await fetchTransactions(args);
    setTransactions(data);
    setIsLoading(false);
  }, [
    selectedAccountIds,
    showFlaggedOnly,
    showUncategorizedOnly,
    showLinkedOnly,
    debouncedSearchQuery,
    filterCategoryId,
    selectedCategoryIds,
    startDateTimestamp,
    endDateTimestamp,
    page,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Data fetching on filter change is intentional
    loadTransactions();
  }, [loadTransactions]);

  // Get filtered category name for display
  const filteredCategory = filterCategoryId
    ? categories?.find((c) => c.id === filterCategoryId)
    : null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCategoryUpdateComplete = (_count: number) => {
    setEditingTransaction(null);
    // Reload transactions to reflect the update
    loadTransactions();
    // Could add a toast notification here showing "Updated {_count} transaction(s)"
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

                {/* Search Input - First position */}
                <SearchInput
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  onClear={() => {
                    setSearchQuery("");
                    setPage(0);
                  }}
                  placeholder="Search descriptions..."
                  className="w-[200px]"
                />

                {/* Date Range */}
                <DateRangePicker
                  value={dateRange}
                  onChange={handleDateRangeChange}
                  placeholder="Date range"
                />

                {/* Accounts Multi-Select (grouped by type) */}
                {accounts && accounts.length > 0 && (
                  <MultiSelectPopover
                    groups={ACCOUNT_TYPE_GROUPS.map((group) => ({
                      label: group.label,
                      options: accounts
                        .filter((acc) => group.types.includes(acc.type as AccountType))
                        .map((acc) => ({
                          value: acc.id,
                          label: acc.name,
                        })),
                    })).filter((group) => group.options.length > 0)}
                    value={selectedAccountIds}
                    onChange={(ids) => {
                      setSelectedAccountIds(ids as string[]);
                      setPage(0);
                    }}
                    placeholder="Accounts"
                    icon={<Building2 className="w-4 h-4 mr-2" />}
                  />
                )}

                {/* Categories Multi-Select (grouped by type) */}
                {categories && categories.length > 0 && (
                  <MultiSelectPopover
                    groups={[
                      {
                        label: "Expense",
                        options: categories
                          .filter((cat) => cat.type === "expense")
                          .map((cat) => ({ value: cat.id, label: cat.name })),
                      },
                      {
                        label: "Income",
                        options: categories
                          .filter((cat) => cat.type === "income")
                          .map((cat) => ({ value: cat.id, label: cat.name })),
                      },
                      {
                        label: "Transfer",
                        options: categories
                          .filter((cat) => cat.type === "transfer")
                          .map((cat) => ({ value: cat.id, label: cat.name })),
                      },
                    ].filter((group) => group.options.length > 0)}
                    value={selectedCategoryIds}
                    onChange={(ids) => {
                      setSelectedCategoryIds(ids as string[]);
                      setPage(0);
                    }}
                    placeholder="Categories"
                  />
                )}

                {/* Status Multi-Select */}
                <MultiSelectPopover
                  options={STATUS_OPTIONS}
                  value={selectedStatuses}
                  onChange={(statuses) => {
                    setSelectedStatuses(statuses as StatusFilter[]);
                    setPage(0);
                  }}
                  placeholder="Status"
                />

                {/* Clear All */}
                {(selectedAccountIds.length > 0 || selectedStatuses.length > 0 || selectedCategoryIds.length > 0 || dateRange || filterCategoryId || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedAccountIds([]);
                      setSelectedStatuses([]);
                      setSelectedCategoryIds([]);
                      setSearchQuery("");
                      clearAllUrlFilters();
                      setPage(0);
                    }}
                  >
                    Clear All
                  </Button>
                )}
              </div>

              {/* Active Filter Badges */}
              {(searchQuery || dateRange || selectedAccountIds.length > 0 || selectedCategoryIds.length > 0 || selectedStatuses.length > 0 || filteredCategory) && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border flex-wrap">
                  <span className="text-xs text-muted-foreground">Active filters:</span>
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                      Search: &quot;{searchQuery}&quot;
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setPage(0);
                        }}
                        className="ml-1 hover:text-primary-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {dateRange && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                      <Calendar className="w-3 h-3" />
                      {dateRange.from && format(dateRange.from, "MMM d, yyyy")}
                      {dateRange.to && ` - ${format(dateRange.to, "MMM d, yyyy")}`}
                      <button
                        onClick={() => handleDateRangeChange(undefined)}
                        className="ml-1 hover:text-primary-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedAccountIds.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                      <Building2 className="w-3 h-3" />
                      {selectedAccountIds.length} {selectedAccountIds.length === 1 ? "Account" : "Accounts"}
                      <button
                        onClick={() => {
                          setSelectedAccountIds([]);
                          setPage(0);
                        }}
                        className="ml-1 hover:text-primary-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedCategoryIds.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                      <Filter className="w-3 h-3" />
                      {selectedCategoryIds.length} {selectedCategoryIds.length === 1 ? "Category" : "Categories"}
                      <button
                        onClick={() => {
                          setSelectedCategoryIds([]);
                          setPage(0);
                        }}
                        className="ml-1 hover:text-primary-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedStatuses.map((status) => (
                    <span key={status} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                      {status === "flagged" && <Flag className="w-3 h-3" />}
                      {status === "uncategorized" && <CircleSlash className="w-3 h-3" />}
                      {status === "linked" && <Link2 className="w-3 h-3" />}
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                      <button
                        onClick={() => {
                          setSelectedStatuses(selectedStatuses.filter((s) => s !== status));
                          if (statusFromParam === status) {
                            updateUrlParams({ category: null });
                          }
                          setPage(0);
                        }}
                        className="ml-1 hover:text-primary-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {filteredCategory && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                      Category: {filteredCategory.name}
                      <button
                        onClick={clearCategoryFilter}
                        className="ml-1 hover:text-primary-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
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
                        <TableHead className="w-[100px]">
                          <button
                            onClick={() => {
                              if (sortBy === "date") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortBy("date");
                                setSortOrder("desc");
                              }
                              setPage(0);
                            }}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            Date
                            {sortBy === "date" ? (
                              sortOrder === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[150px]">Account</TableHead>
                        <TableHead className="w-[150px]">
                          <button
                            onClick={() => {
                              if (sortBy === "category") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortBy("category");
                                setSortOrder("asc");
                              }
                              setPage(0);
                            }}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            Category
                            {sortBy === "category" ? (
                              sortOrder === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead className="w-[120px]">
                          <button
                            onClick={() => {
                              if (sortBy === "amount") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortBy("amount");
                                setSortOrder("desc");
                              }
                              setPage(0);
                            }}
                            className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                          >
                            Amount
                            {sortBy === "amount" ? (
                              sortOrder === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead className="w-[50px]">Link</TableHead>
                        <TableHead className="w-[50px]">Flag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.transactions.map((tx) => (
                        <TableRow key={tx.id}>
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
                              onClick={() => setEditingTransaction(tx.id)}
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
                            <LinkStatusIndicator
                              isLinked={tx.hasLinkedTransaction}
                              linkedAccountName={tx.linkedAccountName}
                              onClick={() => setLinkingTransaction(tx.id)}
                            />
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
                    {isLoading
                      ? "Loading transactions..."
                      : "No transactions found"}
                  </p>
                  {!isLoading && transactions && (
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
            (tx) => tx.id === editingTransaction
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

        {/* Link Transaction Dialog */}
        {(() => {
          const linkingTx = transactions?.transactions.find(
            (tx) => tx.id === linkingTransaction
          );
          return linkingTx ? (
            <LinkTransactionDialog
              transaction={linkingTx}
              open={!!linkingTransaction}
              onClose={() => setLinkingTransaction(null)}
              onLinkComplete={() => {
                setLinkingTransaction(null);
                loadTransactions();
              }}
            />
          ) : null;
        })()}
      </main>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            <div className="animate-pulse">
              <div className="h-8 w-48 bg-muted rounded mb-4" />
              <div className="h-4 w-64 bg-muted rounded" />
            </div>
          </div>
        </main>
      </div>
    }>
      <TransactionsPageContent />
    </Suspense>
  );
}
