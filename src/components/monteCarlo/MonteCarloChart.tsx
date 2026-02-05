"use client";

import { useMemo, useCallback } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { YearResult } from "@/lib/calculations/monteCarlo";

interface MonteCarloChartProps {
  samplePaths: YearResult[][];
  retirementAge?: number;
  planToAge?: number;
  height?: number;
  showPercentiles?: boolean;
}

// Color palette for sample paths
const PATH_COLORS = [
  "hsl(210, 100%, 60%)", // blue
  "hsl(280, 70%, 60%)",  // purple
  "hsl(180, 70%, 50%)",  // teal
  "hsl(330, 70%, 60%)",  // pink
  "hsl(45, 90%, 55%)",   // yellow
  "hsl(15, 80%, 55%)",   // orange
  "hsl(150, 60%, 50%)",  // green
  "hsl(200, 70%, 55%)",  // cyan
  "hsl(260, 60%, 55%)",  // violet
  "hsl(0, 70%, 55%)",    // red
];

export function MonteCarloChart({
  samplePaths,
  retirementAge,
  planToAge,
  height = 400,
  showPercentiles = true,
}: MonteCarloChartProps) {
  // Memoize chart data computation
  const { chartData, successfulPaths } = useMemo(() => {
    if (!samplePaths || samplePaths.length === 0 || samplePaths[0]?.length === 0) {
      return { chartData: [], successfulPaths: [] as number[] };
    }

    // Get the maximum number of years from any path
    const maxYears = Math.max(...samplePaths.map((p) => p.length));

    // Transform data: create one data point per year with all paths
    const data: Array<Record<string, number | null>> = [];
    for (let yearIdx = 0; yearIdx < maxYears; yearIdx++) {
      const point: Record<string, number | null> = {
        year: yearIdx,
        age: retirementAge ? retirementAge + yearIdx : yearIdx,
      };

      // Add each path's balance at this year
      const balances: number[] = [];
      samplePaths.forEach((path, pathIdx) => {
        if (yearIdx < path.length) {
          point[`path${pathIdx}`] = path[yearIdx].endBalance;
          balances.push(path[yearIdx].endBalance);
        } else {
          point[`path${pathIdx}`] = null;
        }
      });

      // Calculate percentiles if we have balances
      if (showPercentiles && balances.length > 0) {
        const sorted = [...balances].sort((a, b) => a - b);
        point.p10 = sorted[Math.floor(sorted.length * 0.1)] ?? sorted[0];
        point.p50 = sorted[Math.floor(sorted.length * 0.5)] ?? sorted[0];
        point.p90 = sorted[Math.floor(sorted.length * 0.9)] ?? sorted[sorted.length - 1];
      }

      data.push(point);
    }

    // Separate successful and failed paths for coloring
    const successful: number[] = [];

    samplePaths.forEach((path, idx) => {
      const lastYear = path[path.length - 1];
      if (lastYear && lastYear.endBalance > 0) {
        successful.push(idx);
      }
    });

    return { chartData: data, successfulPaths: successful };
  }, [samplePaths, retirementAge, showPercentiles]);

  // Memoized tooltip render function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltip = useCallback((props: any) => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
      const data = chartData.find((d) => d.year === label);
      if (!data) return null;

      // Get non-null path values
      const pathValues = (payload as Array<{ dataKey: string; value: number; color: string }>)
        .filter((p) => p.dataKey.startsWith("path") && p.value !== null)
        .map((p) => ({
          name: `Scenario ${parseInt(p.dataKey.replace("path", "")) + 1}`,
          value: p.value,
          color: p.color,
        }))
        .sort((a, b) => b.value - a.value);

      const displayAge = retirementAge ? retirementAge + (label ?? 0) : label;

      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="font-medium mb-2">
            Year {label}{displayAge !== label ? ` (Age ${displayAge})` : ""}
          </p>
          {showPercentiles && data.p10 !== undefined && (
            <div className="mb-2 pb-2 border-b border-border text-sm">
              <div className="flex justify-between text-green-500">
                <span>P90:</span>
                <span>{formatCurrency(data.p90 as number)}</span>
              </div>
              <div className="flex justify-between text-primary font-medium">
                <span>Median:</span>
                <span>{formatCurrency(data.p50 as number)}</span>
              </div>
              <div className="flex justify-between text-amber-500">
                <span>P10:</span>
                <span>{formatCurrency(data.p10 as number)}</span>
              </div>
            </div>
          )}
          <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
            {pathValues.slice(0, 5).map((p, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span style={{ color: p.color }}>{p.name}</span>
                <span>{formatCurrency(p.value)}</span>
              </div>
            ))}
            {pathValues.length > 5 && (
              <p className="text-muted-foreground text-xs">
                +{pathValues.length - 5} more paths...
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  }, [chartData, retirementAge, showPercentiles]);

  // Handle empty data case after hooks
  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg"
        style={{ height }}
      >
        No simulation data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      >
        <defs>
          <linearGradient id="percentileGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />

        <XAxis
          dataKey={retirementAge ? "age" : "year"}
          tick={{ fill: "currentColor", fontSize: 12 }}
          tickLine={{ stroke: "currentColor" }}
          className="text-muted-foreground"
          label={{
            value: retirementAge ? "Age" : "Year",
            position: "bottom",
            offset: 0,
            fill: "currentColor",
            className: "text-muted-foreground",
          }}
          tickFormatter={(value) => {
            // Show every 5 years
            if (value % 5 === 0) return value.toString();
            return "";
          }}
        />

        <YAxis
          tickFormatter={(value) => {
            if (value >= 1000000) {
              return `$${(value / 1000000).toFixed(1)}M`;
            }
            if (value >= 1000) {
              return `$${(value / 1000).toFixed(0)}k`;
            }
            return `$${value}`;
          }}
          tick={{ fill: "currentColor", fontSize: 12 }}
          tickLine={{ stroke: "currentColor" }}
          className="text-muted-foreground"
        />

        <Tooltip content={renderTooltip} />

        {/* Percentile band */}
        {showPercentiles && (
          <>
            <Area
              type="monotone"
              dataKey="p90"
              stroke="none"
              fill="url(#percentileGradient)"
              fillOpacity={1}
            />
            <Area
              type="monotone"
              dataKey="p10"
              stroke="none"
              fill="hsl(var(--background))"
              fillOpacity={1}
            />
          </>
        )}

        {/* Sample paths */}
        {samplePaths.map((_, idx) => {
          const isSuccessful = successfulPaths.includes(idx);
          const baseColor = PATH_COLORS[idx % PATH_COLORS.length];

          return (
            <Line
              key={idx}
              type="monotone"
              dataKey={`path${idx}`}
              stroke={isSuccessful ? baseColor : "hsl(0, 70%, 55%)"}
              strokeWidth={isSuccessful ? 1.5 : 2}
              strokeOpacity={isSuccessful ? 0.6 : 0.8}
              strokeDasharray={isSuccessful ? undefined : "4 2"}
              dot={false}
              connectNulls={false}
            />
          );
        })}

        {/* Percentile lines */}
        {showPercentiles && (
          <>
            <Line
              type="monotone"
              dataKey="p90"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={2}
              dot={false}
              name="90th Percentile"
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              name="Median"
            />
            <Line
              type="monotone"
              dataKey="p10"
              stroke="hsl(45, 93%, 47%)"
              strokeWidth={2}
              dot={false}
              name="10th Percentile"
            />
          </>
        )}

        {/* Zero line */}
        <ReferenceLine
          y={0}
          stroke="hsl(var(--destructive))"
          strokeWidth={2}
          strokeDasharray="5 5"
        />

        {/* Plan to age marker */}
        {planToAge && retirementAge && (
          <ReferenceLine
            x={planToAge}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="5 5"
            label={{
              value: `Age ${planToAge}`,
              position: "top",
              fill: "currentColor",
              fontSize: 12,
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Legend component to show path status
export function MonteCarloChartLegend({
  successCount,
  failureCount,
}: {
  successCount: number;
  failureCount: number;
}) {
  return (
    <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mt-2">
      <div className="flex items-center gap-2">
        <div className="w-4 h-0.5 bg-primary" />
        <span>Median path</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-0.5 bg-green-500" />
        <span>Success ({successCount})</span>
      </div>
      {failureCount > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-red-500 border-dashed" style={{ borderTopWidth: 2, borderStyle: "dashed" }} />
          <span>Failure ({failureCount})</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="w-8 h-3 bg-primary/20 rounded" />
        <span>P10-P90 range</span>
      </div>
    </div>
  );
}
