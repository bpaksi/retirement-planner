"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
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

export default function InvestmentsPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<
    Id<"accounts"> | "all"
  >("all");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showTargetsDialog, setShowTargetsDialog] = useState(false);

  // Queries
  const accountsWithHoldings = useQuery(
    api.allocations.queries.getAccountsWithHoldings
  );
  const portfolioSummary = useQuery(api.holdings.queries.getPortfolioSummary, {
    accountId:
      selectedAccountId === "all" ? undefined : selectedAccountId,
  });
  const allocation = useQuery(api.holdings.queries.getAllocation, {
    accountId:
      selectedAccountId === "all" ? undefined : selectedAccountId,
  });
  const rebalancing = useQuery(api.holdings.queries.getRebalancingAnalysis, {
    accountId:
      selectedAccountId === "all" ? undefined : selectedAccountId,
  });
  const targets = useQuery(api.allocations.queries.getTargets, {
    accountId:
      selectedAccountId === "all" ? undefined : selectedAccountId,
  });

  // Mutations
  const setAllTargets = useMutation(api.allocations.mutations.setAllTargets);

  // Computed values
  const totalValue = useMemo(() => {
    if (!portfolioSummary) return 0;
    return portfolioSummary.reduce((sum, h) => sum + h.currentValue, 0);
  }, [portfolioSummary]);

  const totalGainLoss = useMemo(() => {
    if (!portfolioSummary) return 0;
    return portfolioSummary.reduce((sum, h) => sum + h.gainLoss, 0);
  }, [portfolioSummary]);

  const totalCostBasis = useMemo(() => {
    if (!portfolioSummary) return 0;
    return portfolioSummary.reduce((sum, h) => sum + (h.costBasis ?? 0), 0);
  }, [portfolioSummary]);

  const totalGainLossPercent = totalCostBasis > 0 ? totalGainLoss / totalCostBasis : 0;

  const holdingsCount = portfolioSummary?.length ?? 0;

  const isLoading =
    portfolioSummary === undefined ||
    allocation === undefined ||
    rebalancing === undefined;

  const selectedAccount = accountsWithHoldings?.find(
    (a) => a._id === selectedAccountId
  );

  const handleSaveTargets = async (
    newTargets: Array<{
      assetClass: AssetClass;
      targetPercent: number;
      rebalanceThreshold: number;
    }>
  ) => {
    await setAllTargets({
      accountId:
        selectedAccountId === "all" ? undefined : selectedAccountId,
      targets: newTargets,
    });
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
                onChange={(e) =>
                  setSelectedAccountId(
                    e.target.value as Id<"accounts"> | "all"
                  )
                }
                className="w-[200px]"
              >
                <option value="all">All Accounts</option>
                {accountsWithHoldings?.map((account) => (
                  <option key={account._id} value={account._id}>
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
                      totalGainLoss >= 0
                        ? "bg-green-500/10"
                        : "bg-red-500/10"
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
                            totalGainLoss >= 0
                              ? "text-green-500"
                              : "text-red-500"
                          )}
                        >
                          {totalGainLoss >= 0 ? "+" : ""}
                          {formatCurrency(totalGainLoss)}
                        </p>
                        <span
                          className={cn(
                            "text-sm",
                            totalGainLoss >= 0
                              ? "text-green-500"
                              : "text-red-500"
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
                      holdings={portfolioSummary ?? []}
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
                      allocation={allocation?.allocation ?? []}
                      totalValue={allocation?.totalValue ?? 0}
                      targets={targets?.targets ?? []}
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
                      analysis={rebalancing?.analysis ?? []}
                      totalValue={rebalancing?.totalValue ?? 0}
                      needsRebalanceCount={rebalancing?.needsRebalanceCount ?? 0}
                      hasTargets={rebalancing?.hasTargets ?? false}
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
          onComplete={() => setShowImportDialog(false)}
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
        existingTargets={targets?.targets ?? []}
        isAccountSpecific={selectedAccountId !== "all"}
        accountName={selectedAccount?.name}
      />
    </div>
  );
}
