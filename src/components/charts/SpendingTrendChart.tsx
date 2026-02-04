"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface ChartClickData {
  activePayload?: Array<{
    payload: { year: number; month: string };
  }>;
}

interface TrendData {
  month: string;
  year: number;
  income: number;
  expenses: number;
  net: number;
}

interface SpendingTrendChartProps {
  data: TrendData[];
  height?: number;
  showIncome?: boolean;
  onMonthClick?: (year: number, month: string) => void;
}

export function SpendingTrendChart({
  data,
  height = 300,
  showIncome = true,
  onMonthClick,
}: SpendingTrendChartProps) {
  const chartData = data.map((item) => ({
    name: `${item.month} ${item.year}`,
    income: item.income,
    expenses: item.expenses,
    net: item.net,
    year: item.year,
    month: item.month,
  }));

  const handleBarClick = (data: { year: number; month: string }) => {
    if (onMonthClick) {
      onMonthClick(data.year, data.month);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        No trend data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        onClick={(data) => {
          const chartData = data as ChartClickData;
          if (chartData && chartData.activePayload && chartData.activePayload[0]) {
            const payload = chartData.activePayload[0].payload;
            handleBarClick({ year: payload.year, month: payload.month });
          }
        }}
        style={{ cursor: onMonthClick ? "pointer" : "default" }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="name"
          tick={{ fill: "currentColor", fontSize: 12 }}
          tickLine={{ stroke: "currentColor" }}
          className="text-muted-foreground"
        />
        <YAxis
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          tick={{ fill: "currentColor", fontSize: 12 }}
          tickLine={{ stroke: "currentColor" }}
          className="text-muted-foreground"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {showIncome && (
          <Bar
            dataKey="income"
            name="Income"
            fill="var(--color-success)"
            radius={[4, 4, 0, 0]}
            style={{ cursor: onMonthClick ? "pointer" : "default" }}
          />
        )}
        <Bar
          dataKey="expenses"
          name="Expenses"
          fill="var(--color-destructive)"
          radius={[4, 4, 0, 0]}
          style={{ cursor: onMonthClick ? "pointer" : "default" }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
