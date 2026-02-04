"use client";

import { useCallback } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { ProjectionYear } from "@/lib/calculations/projections";

interface ProjectionChartProps {
  data: ProjectionYear[];
  retirementAge: number;
  currentAge: number;
  height?: number;
}

export function ProjectionChart({
  data,
  retirementAge,
  currentAge,
  height = 400,
}: ProjectionChartProps) {
  // Transform data for chart - we need to show range between pessimistic and optimistic
  const chartData = data.map((item) => ({
    age: item.age,
    year: item.year,
    expected: item.expected,
    optimistic: item.optimistic,
    pessimistic: item.pessimistic,
    // For area range, we show the difference between optimistic and pessimistic
    range: [item.pessimistic, item.optimistic],
    isRetired: item.isRetired,
  }));

  // Memoized tooltip render function to avoid creating new component on each render
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltip = useCallback((props: any) => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
      const data = chartData.find((d) => d.age === label);
      if (!data) return null;

      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">
            Age {label} ({data.year})
            {data.isRetired && (
              <span className="ml-2 text-xs text-muted-foreground">Retired</span>
            )}
          </p>
          <div className="space-y-1 text-sm">
            <p className="text-green-500">
              Optimistic: {formatCurrency(data.optimistic)}
            </p>
            <p className="text-primary">
              Expected: {formatCurrency(data.expected)}
            </p>
            <p className="text-amber-500">
              Pessimistic: {formatCurrency(data.pessimistic)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        No projection data available
      </div>
    );
  }

  // Find the retirement year for the reference line
  const retirementYear = chartData.find((d) => d.age === retirementAge)?.year;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      >
        <defs>
          <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />

        <XAxis
          dataKey="age"
          tick={{ fill: "currentColor", fontSize: 12 }}
          tickLine={{ stroke: "currentColor" }}
          className="text-muted-foreground"
          label={{
            value: "Age",
            position: "bottom",
            offset: 0,
            fill: "currentColor",
            className: "text-muted-foreground",
          }}
          tickFormatter={(value) => {
            // Show every 5 years
            if (value % 5 === 0 || value === currentAge || value === retirementAge) {
              return value.toString();
            }
            return "";
          }}
        />

        <YAxis
          tickFormatter={(value) => {
            if (value >= 1000000) {
              return `$${(value / 1000000).toFixed(1)}M`;
            }
            return `$${(value / 1000).toFixed(0)}k`;
          }}
          tick={{ fill: "currentColor", fontSize: 12 }}
          tickLine={{ stroke: "currentColor" }}
          className="text-muted-foreground"
        />

        <Tooltip content={renderTooltip} />

        <Legend
          verticalAlign="top"
          height={36}
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              expected: "Expected (5%)",
              optimistic: "Optimistic (7%)",
              pessimistic: "Pessimistic (3%)",
            };
            return labels[value] || value;
          }}
        />

        {/* Range band between pessimistic and optimistic */}
        <Area
          type="monotone"
          dataKey="optimistic"
          stroke="none"
          fill="url(#rangeGradient)"
          fillOpacity={1}
          name="optimistic"
          legendType="none"
        />
        <Area
          type="monotone"
          dataKey="pessimistic"
          stroke="none"
          fill="hsl(var(--background))"
          fillOpacity={1}
          name="pessimistic"
          legendType="none"
        />

        {/* Lines for each scenario */}
        <Line
          type="monotone"
          dataKey="optimistic"
          stroke="hsl(142, 76%, 36%)"
          strokeWidth={2}
          dot={false}
          name="optimistic"
        />

        <Line
          type="monotone"
          dataKey="expected"
          stroke="hsl(var(--primary))"
          strokeWidth={3}
          dot={false}
          name="expected"
        />

        <Line
          type="monotone"
          dataKey="pessimistic"
          stroke="hsl(45, 93%, 47%)"
          strokeWidth={2}
          dot={false}
          name="pessimistic"
        />

        {/* Retirement marker */}
        {retirementYear && (
          <ReferenceLine
            x={retirementAge}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="5 5"
            label={{
              value: "Retirement",
              position: "top",
              fill: "currentColor",
              fontSize: 12,
            }}
          />
        )}

        {/* Zero line */}
        <ReferenceLine
          y={0}
          stroke="hsl(var(--destructive))"
          strokeWidth={1}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
