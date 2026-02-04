"use client";

import { useState, useMemo } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { formatCurrency, cn } from "@/lib/utils";
import {
  ASSET_CLASS_CONFIG,
  type AssetClass,
} from "@/lib/constants/investments";
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown } from "lucide-react";

interface HoldingWithDetails {
  _id: Id<"holdings">;
  accountId: Id<"accounts">;
  symbol: string;
  name: string;
  shares: number;
  costBasis?: number;
  assetClass: AssetClass;
  lastPrice?: number;
  lastPriceUpdated?: number;
  account: {
    _id: Id<"accounts">;
    name: string;
    institution: string;
  } | null;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

interface HoldingsTabProps {
  holdings: HoldingWithDetails[];
  showAccount?: boolean;
}

type SortField =
  | "symbol"
  | "name"
  | "account"
  | "shares"
  | "price"
  | "value"
  | "costBasis"
  | "gainLoss"
  | "assetClass";
type SortDirection = "asc" | "desc";

export function HoldingsTab({ holdings, showAccount = false }: HoldingsTabProps) {
  const [sortField, setSortField] = useState<SortField>("value");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "symbol":
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "account":
          comparison = (a.account?.name ?? "").localeCompare(
            b.account?.name ?? ""
          );
          break;
        case "shares":
          comparison = a.shares - b.shares;
          break;
        case "price":
          comparison = (a.lastPrice ?? 0) - (b.lastPrice ?? 0);
          break;
        case "value":
          comparison = a.currentValue - b.currentValue;
          break;
        case "costBasis":
          comparison = (a.costBasis ?? 0) - (b.costBasis ?? 0);
          break;
        case "gainLoss":
          comparison = a.gainLossPercent - b.gainLossPercent;
          break;
        case "assetClass":
          comparison = a.assetClass.localeCompare(b.assetClass);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [holdings, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Render helper for sortable headers (not a component to avoid static component issues)
  const renderSortHeader = (
    field: SortField,
    children: React.ReactNode,
    className?: string
  ) => (
    <TableHead
      key={field}
      className={cn("cursor-pointer select-none hover:bg-muted/50", className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  if (holdings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-2">No holdings found</p>
        <p className="text-sm">Import holdings to get started</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {renderSortHeader("symbol", "Symbol")}
          {renderSortHeader("name", "Name")}
          {showAccount && renderSortHeader("account", "Account")}
          {renderSortHeader("shares", "Shares", "text-right")}
          {renderSortHeader("price", "Price", "text-right")}
          {renderSortHeader("value", "Value", "text-right")}
          {renderSortHeader("costBasis", "Cost Basis", "text-right")}
          {renderSortHeader("gainLoss", "Gain/Loss", "text-right")}
          {renderSortHeader("assetClass", "Asset Class")}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedHoldings.map((holding) => (
          <TableRow key={holding._id}>
            <TableCell className="font-mono text-sm font-medium">
              {holding.symbol}
            </TableCell>
            <TableCell
              className="max-w-[200px] truncate"
              title={holding.name}
            >
              {holding.name}
            </TableCell>
            {showAccount && (
              <TableCell className="text-muted-foreground">
                {holding.account?.name ?? "Unknown"}
              </TableCell>
            )}
            <TableCell className="text-right font-mono text-sm">
              {holding.shares.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {holding.lastPrice
                ? formatCurrency(holding.lastPrice)
                : "-"}
            </TableCell>
            <TableCell className="text-right font-mono text-sm font-medium">
              {formatCurrency(holding.currentValue)}
            </TableCell>
            <TableCell className="text-right font-mono text-sm text-muted-foreground">
              {holding.costBasis
                ? formatCurrency(holding.costBasis)
                : "-"}
            </TableCell>
            <TableCell className="text-right">
              {holding.costBasis ? (
                <div className="flex items-center justify-end gap-1">
                  {holding.gainLoss >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span
                    className={cn(
                      "font-mono text-sm",
                      holding.gainLoss >= 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {holding.gainLoss >= 0 ? "+" : ""}
                    {(holding.gainLossPercent * 100).toFixed(1)}%
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  backgroundColor: `${ASSET_CLASS_CONFIG[holding.assetClass]?.color ?? "#6B7280"}20`,
                  color: ASSET_CLASS_CONFIG[holding.assetClass]?.color ?? "#6B7280",
                }}
              >
                {ASSET_CLASS_CONFIG[holding.assetClass]?.label ?? holding.assetClass}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
