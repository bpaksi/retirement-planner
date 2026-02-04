"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import {
  ASSET_CLASS_CONFIG,
  type AssetClass,
} from "@/lib/constants/investments";

interface AllocationData {
  assetClass: AssetClass;
  value: number;
  percent: number;
  holdings: number;
}

interface ChartDataItem {
  name: string;
  value: number;
  percent: number;
  color: string;
  assetClass: AssetClass;
}

interface AllocationPieChartProps {
  data: AllocationData[];
  showLegend?: boolean;
  height?: number;
  onAssetClassClick?: (assetClass: AssetClass) => void;
}

interface LegendEntry {
  value: string;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataItem }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(data.value)}
        </p>
        <p className="text-sm text-muted-foreground">
          {(data.percent * 100).toFixed(1)}% of portfolio
        </p>
      </div>
    );
  }
  return null;
}

function CustomLegend({ payload }: { payload?: LegendEntry[] }) {
  if (!payload) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
      {payload.map((entry, index) => (
        <li key={index} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function AllocationPieChart({
  data,
  showLegend = true,
  height = 300,
  onAssetClassClick,
}: AllocationPieChartProps) {
  const chartData: ChartDataItem[] = data.map((item) => ({
    name: ASSET_CLASS_CONFIG[item.assetClass]?.label ?? item.assetClass,
    value: item.value,
    percent: item.percent,
    color: ASSET_CLASS_CONFIG[item.assetClass]?.color ?? "#6B7280",
    assetClass: item.assetClass,
  }));

  const handleClick = (data: ChartDataItem) => {
    if (onAssetClassClick) {
      onAssetClassClick(data.assetClass);
    }
  };

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        No allocation data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          onClick={handleClick}
          style={{ cursor: onAssetClassClick ? "pointer" : "default" }}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.color}
              style={{ cursor: onAssetClassClick ? "pointer" : "default" }}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {showLegend && <Legend content={<CustomLegend />} />}
      </PieChart>
    </ResponsiveContainer>
  );
}
