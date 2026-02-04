"use client";

import { AllocationPieChart } from "@/components/charts/AllocationPieChart";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { formatCurrency, cn } from "@/lib/utils";
import {
  ASSET_CLASS_CONFIG,
  type AssetClass,
} from "@/lib/constants/investments";
import { Settings } from "lucide-react";

interface AllocationData {
  assetClass: AssetClass;
  value: number;
  percent: number;
  holdings: number;
}

interface TargetData {
  assetClass: string;
  targetPercent: number;
  rebalanceThreshold: number;
}

interface AllocationTabProps {
  allocation: AllocationData[];
  totalValue: number;
  targets: TargetData[];
  onEditTargets: () => void;
}

export function AllocationTab({
  allocation,
  totalValue,
  targets,
  onEditTargets,
}: AllocationTabProps) {
  // Create a map for targets
  const targetMap = new Map(targets.map((t) => [t.assetClass, t.targetPercent]));

  // Merge allocation with targets for display
  const tableData = allocation.map((item) => ({
    ...item,
    targetPercent: targetMap.get(item.assetClass) ?? 0,
    difference: item.percent - (targetMap.get(item.assetClass) ?? 0),
  }));

  // Add target-only asset classes (ones with targets but no current holdings)
  const existingClasses = new Set(allocation.map((a) => a.assetClass));
  for (const target of targets) {
    if (!existingClasses.has(target.assetClass as AssetClass)) {
      tableData.push({
        assetClass: target.assetClass as AssetClass,
        value: 0,
        percent: 0,
        holdings: 0,
        targetPercent: target.targetPercent,
        difference: -target.targetPercent,
      });
    }
  }

  // Sort by value descending, then by target
  tableData.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return b.targetPercent - a.targetPercent;
  });

  const hasTargets = targets.length > 0;

  if (allocation.length === 0 && targets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-2">No allocation data available</p>
        <p className="text-sm">Import holdings to see your asset allocation</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="flex flex-col items-center justify-center">
          {allocation.length > 0 ? (
            <AllocationPieChart data={allocation} height={280} />
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              No holdings data
            </div>
          )}
          <p className="text-center text-sm text-muted-foreground mt-2">
            Total Portfolio Value: {formatCurrency(totalValue)}
          </p>
        </div>

        {/* Allocation Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Allocation Breakdown</h3>
            <Button variant="outline" size="sm" onClick={onEditTargets}>
              <Settings className="w-4 h-4 mr-2" />
              {hasTargets ? "Edit Targets" : "Set Targets"}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Class</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Current %</TableHead>
                <TableHead className="text-right">Target %</TableHead>
                <TableHead className="text-right">Difference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((item) => (
                <TableRow key={item.assetClass}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            ASSET_CLASS_CONFIG[item.assetClass]?.color ??
                            "#6B7280",
                        }}
                      />
                      {ASSET_CLASS_CONFIG[item.assetClass]?.label ??
                        item.assetClass}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(item.value)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {(item.percent * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {hasTargets
                      ? `${(item.targetPercent * 100).toFixed(1)}%`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {hasTargets ? (
                      <span
                        className={cn(
                          item.difference > 0.02
                            ? "text-blue-500"
                            : item.difference < -0.02
                              ? "text-orange-500"
                              : "text-muted-foreground"
                        )}
                      >
                        {item.difference >= 0 ? "+" : ""}
                        {(item.difference * 100).toFixed(1)}%
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!hasTargets && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Set allocation targets to track portfolio drift
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
