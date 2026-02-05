"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  fetchHoldingsWithAccounts,
  fetchAccounts,
  fetchAllocationTargets,
} from "@/app/actions/investments";
import { upsertAllocationTarget } from "@/app/actions/allocationTargets";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Dialog } from "@/components/ui/Dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { ImportWizard } from "@/components/import/ImportWizard";
import { HoldingsTab } from "@/components/investments/HoldingsTab";
import { AllocationTab } from "@/components/investments/AllocationTab";
import { RebalancingTab } from "@/components/investments/RebalancingTab";
import { AllocationTargetsDialog } from "@/components/investments/AllocationTargetsDialog";
import { formatCurrency, cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Upload,
  Briefcase,
  PieChart,
  Scale,
  Loader2,
} from "lucide-react";
import { type AssetClass } from "@/lib/constants/investments";

// Types for the data structures
type HoldingWithAccount = Awaited<ReturnType<typeof fetchHoldingsWithAccounts>>[number];
type Account = Awaited<ReturnType<typeof fetchAccounts>>[number];
type AllocationTarget = Awaited<ReturnType<typeof fetchAllocationTargets>>[number];

// Holding with computed values for display
interface HoldingWithDetails {
  id: string;
  _id: string; // For compatibility with HoldingsTab which expects _id
  accountId: string;
  symbol: string;
  name: string;
  shares: number;
  costBasis?: number | null;
  assetClass: AssetClass;
  lastPrice?: number | null;
  lastPriceUpdated?: number | null;
  account: {
    _id: string;
    name: string;
    institution: string;
  } | null;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

// Allocation data for display
interface AllocationData {
  assetClass: AssetClass;
  value: number;
  percent: number;
  holdings: number;
}

// Rebalancing analysis
interface RebalanceAnalysis {
  assetClass: AssetClass;
  currentValue: number;
  currentPercent: number;
  targetPercent: number;
  threshold: number;
  drift: number;
  needsRebalance: boolean;
}

// Target data for display
interface TargetData {
  assetClass: string;
  targetPercent: number;
  rebalanceThreshold: number;
}

export default function InvestmentsPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | "all">("all");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showTargetsDialog, setShowTargetsDialog] = useState(false);

  // Data state
  const [holdings, setHoldings] = useState<HoldingWithAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allocationTargets, setAllocationTargets] = useState<AllocationTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data function
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [holdingsData, accountsData, targets] = await Promise.all([
        fetchHoldingsWithAccounts(),
        fetchAccounts(true), // active only
        fetchAllocationTargets(selectedAccountId === "all" ? undefined : selectedAccountId),
      ]);
      setHoldings(holdingsData);
      setAccounts(accountsData);
      setAllocationTargets(targets);
    } catch (error) {
      console.error("Failed to load investments data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter holdings by selected account
  const filteredHoldings = useMemo(() => {
    if (selectedAccountId === "all") {
      return holdings;
    }
    return holdings.filter((h) => h.accountId === selectedAccountId);
  }, [holdings, selectedAccountId]);

  // Get accounts that have holdings (for the filter dropdown)
  const accountsWithHoldings = useMemo(() => {
    const accountIdsWithHoldings = new Set(holdings.map((h) => h.accountId));
    return accounts.filter((a) => accountIdsWithHoldings.has(a.id));
  }, [accounts, holdings]);

  // Compute portfolio summary with details
  const portfolioSummary: HoldingWithDetails[] = useMemo(() => {
    return filteredHoldings.map((h) => {
      const currentValue = h.shares * (h.lastPrice ?? 0);
      const gainLoss = h.costBasis ? currentValue - h.costBasis : 0;
      const gainLossPercent = h.costBasis && h.costBasis > 0 ? gainLoss / h.costBasis : 0;

      return {
        id: h.id,
        _id: h.id, // For compatibility with HoldingsTab
        accountId: h.accountId,
        symbol: h.symbol,
        name: h.name,
        shares: h.shares,
        costBasis: h.costBasis,
        assetClass: h.assetClass as AssetClass,
        lastPrice: h.lastPrice,
        lastPriceUpdated: h.lastPriceUpdated,
        account: h.account
          ? {
              _id: h.account.id,
              name: h.account.name,
              institution: h.account.institution,
            }
          : null,
        currentValue,
        gainLoss,
        gainLossPercent,
      };
    });
  }, [filteredHoldings]);

  // Compute totals
  const totalValue = useMemo(() => {
    return portfolioSummary.reduce((sum, h) => sum + h.currentValue, 0);
  }, [portfolioSummary]);

  const totalGainLoss = useMemo(() => {
    return portfolioSummary.reduce((sum, h) => sum + h.gainLoss, 0);
  }, [portfolioSummary]);

  const totalCostBasis = useMemo(() => {
    return portfolioSummary.reduce((sum, h) => sum + (h.costBasis ?? 0), 0);
  }, [portfolioSummary]);

  const totalGainLossPercent = totalCostBasis > 0 ? totalGainLoss / totalCostBasis : 0;
  const holdingsCount = portfolioSummary.length;

  // Compute allocation by asset class
  const allocation: AllocationData[] = useMemo(() => {
    const byClass: Record<string, { value: number; count: number }> = {};

    for (const h of portfolioSummary) {
      if (!byClass[h.assetClass]) {
        byClass[h.assetClass] = { value: 0, count: 0 };
      }
      byClass[h.assetClass].value += h.currentValue;
      byClass[h.assetClass].count += 1;
    }

    return Object.entries(byClass).map(([assetClass, data]) => ({
      assetClass: assetClass as AssetClass,
      value: data.value,
      percent: totalValue > 0 ? data.value / totalValue : 0,
      holdings: data.count,
    }));
  }, [portfolioSummary, totalValue]);

  // Convert allocation targets to display format
  const targets: TargetData[] = useMemo(() => {
    return allocationTargets.map((t) => ({
      assetClass: t.assetClass,
      targetPercent: t.targetPercent,
      rebalanceThreshold: t.rebalanceThreshold,
    }));
  }, [allocationTargets]);

  // Create a map for quick target lookup
  const targetMap = useMemo(() => {
    return new Map(allocationTargets.map((t) => [t.assetClass, t]));
  }, [allocationTargets]);

  // Compute rebalancing analysis
  const rebalancing = useMemo(() => {
    const hasTargets = allocationTargets.length > 0;

    if (!hasTargets) {
      return {
        analysis: [] as RebalanceAnalysis[],
        totalValue,
        needsRebalanceCount: 0,
        hasTargets: false,
      };
    }

    // Get all asset classes that either have holdings or targets
    const allAssetClasses = new Set([
      ...allocation.map((a) => a.assetClass),
      ...allocationTargets.map((t) => t.assetClass as AssetClass),
    ]);

    const analysis: RebalanceAnalysis[] = Array.from(allAssetClasses).map((assetClass) => {
      const alloc = allocation.find((a) => a.assetClass === assetClass);
      const target = targetMap.get(assetClass);

      const currentValue = alloc?.value ?? 0;
      const currentPercent = totalValue > 0 ? currentValue / totalValue : 0;
      const targetPercent = target?.targetPercent ?? 0;
      const threshold = target?.rebalanceThreshold ?? 0.05;
      const drift = currentPercent - targetPercent;
      const needsRebalance = Math.abs(drift) > threshold;

      return {
        assetClass,
        currentValue,
        currentPercent,
        targetPercent,
        threshold,
        drift,
        needsRebalance,
      };
    });

    const needsRebalanceCount = analysis.filter((a) => a.needsRebalance).length;

    return {
      analysis,
      totalValue,
      needsRebalanceCount,
      hasTargets: true,
    };
  }, [allocation, allocationTargets, targetMap, totalValue]);

  // Get selected account info
  const selectedAccount = accountsWithHoldings.find((a) => a.id === selectedAccountId);

  // Handle saving allocation targets
  const handleSaveTargets = async (
    newTargets: Array<{
      assetClass: AssetClass;
      targetPercent: number;
      rebalanceThreshold: number;
    }>
  ) => {
    for (const target of newTargets) {
      await upsertAllocationTarget({
        accountId: selectedAccountId === "all" ? undefined : selectedAccountId,
        assetClass: target.assetClass,
        targetPercent: target.targetPercent,
        rebalanceThreshold: target.rebalanceThreshold,
      });
    }
    // Reload data after saving
    loadData();
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Investments</h1>
              <p className="text-muted-foreground mt-1">
                Track your portfolio and asset allocation
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Account Filter */}
              <Select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value as string | "all")}
                className="w-[200px]"
              >
                <option value="all">All Accounts</option>
                {accountsWithHoldings.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
              <Button onClick={() => setShowImportDialog(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import Holdings
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mt-1" />
                    ) : (
                      <p className="text-2xl font-semibold">
                        {formatCurrency(totalValue)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      totalGainLoss >= 0 ? "bg-green-500/10" : "bg-red-500/10"
                    )}
                  >
                    {totalGainLoss >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Gain/Loss
                    </p>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mt-1" />
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <p
                          className={cn(
                            "text-2xl font-semibold",
                            totalGainLoss >= 0 ? "text-green-500" : "text-red-500"
                          )}
                        >
                          {totalGainLoss >= 0 ? "+" : ""}
                          {formatCurrency(totalGainLoss)}
                        </p>
                        <span
                          className={cn(
                            "text-sm",
                            totalGainLoss >= 0 ? "text-green-500" : "text-red-500"
                          )}
                        >
                          ({totalGainLossPercent >= 0 ? "+" : ""}
                          {(totalGainLossPercent * 100).toFixed(1)}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <PieChart className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Holdings</p>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mt-1" />
                    ) : (
                      <p className="text-2xl font-semibold">{holdingsCount}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="holdings">
                <TabsList>
                  <TabsTrigger value="holdings">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Holdings
                  </TabsTrigger>
                  <TabsTrigger value="allocation">
                    <PieChart className="w-4 h-4 mr-2" />
                    Allocation
                  </TabsTrigger>
                  <TabsTrigger value="rebalancing">
                    <Scale className="w-4 h-4 mr-2" />
                    Rebalancing
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="holdings" className="mt-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <HoldingsTab
                      holdings={portfolioSummary as unknown as Parameters<typeof HoldingsTab>[0]['holdings']}
                      showAccount={selectedAccountId === "all"}
                    />
                  )}
                </TabsContent>

                <TabsContent value="allocation" className="mt-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <AllocationTab
                      allocation={allocation}
                      totalValue={totalValue}
                      targets={targets}
                      onEditTargets={() => setShowTargetsDialog(true)}
                    />
                  )}
                </TabsContent>

                <TabsContent value="rebalancing" className="mt-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <RebalancingTab
                      analysis={rebalancing.analysis}
                      totalValue={rebalancing.totalValue}
                      needsRebalanceCount={rebalancing.needsRebalanceCount}
                      hasTargets={rebalancing.hasTargets}
                      onEditTargets={() => setShowTargetsDialog(true)}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Import Dialog */}
      <Dialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        className="max-w-3xl"
      >
        <ImportWizard
          onComplete={() => {
            setShowImportDialog(false);
            loadData(); // Reload data after import
          }}
          defaultAccountId={
            selectedAccountId !== "all" ? selectedAccountId : undefined
          }
        />
      </Dialog>

      {/* Allocation Targets Dialog */}
      <AllocationTargetsDialog
        open={showTargetsDialog}
        onClose={() => setShowTargetsDialog(false)}
        onSave={handleSaveTargets}
        existingTargets={targets}
        isAccountSpecific={selectedAccountId !== "all"}
        accountName={selectedAccount?.name}
      />
    </div>
  );
}
