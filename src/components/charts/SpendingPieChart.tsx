"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface SpendingData {
  category: {
    id: string;
    name: string;
    color: string;
    isEssential: boolean;
  } | null;
  total: number;
  count: number;
}

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
  isEssential: boolean;
  categoryId: string | null;
}

interface SpendingPieChartProps {
  data: SpendingData[];
  showLegend?: boolean;
  height?: number;
  onCategoryClick?: (categoryId: string) => void;
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
        <p className="text-xs text-muted-foreground mt-1">
          {data.isEssential ? "Essential" : "Discretionary"}
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

export function SpendingPieChart({
  data,
  showLegend = true,
  height = 300,
  onCategoryClick,
}: SpendingPieChartProps) {
  const chartData: ChartDataItem[] = data.map((item) => ({
    name: item.category?.name || "Uncategorized",
    value: item.total,
    color: item.category?.color || "#607D8B",
    isEssential: item.category?.isEssential || false,
    categoryId: item.category?.id || null,
  }));

  const handleClick = (data: ChartDataItem) => {
    if (data.categoryId && onCategoryClick) {
      onCategoryClick(data.categoryId);
    }
  };

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        No spending data available
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
          style={{ cursor: onCategoryClick ? "pointer" : "default" }}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.color}
              style={{ cursor: onCategoryClick && entry.categoryId ? "pointer" : "default" }}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {showLegend && <Legend content={<CustomLegend />} />}
      </PieChart>
    </ResponsiveContainer>
  );
}
