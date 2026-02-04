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
  Bar,
} from "recharts";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

interface GuardrailsYear {
  year: number;
  age: number;
  portfolio: number;
  spending: number;
  baseSpending: number;
  income: number;
  oneTimeEvent: number;
  isRetired: boolean;
  guardrailTriggered: "upper" | "lower" | null;
  spendingAdjustment: number;
  upperThreshold: number;
  lowerThreshold: number;
}

interface GuardrailsSummary {
  upperTriggerCount: number;
  lowerTriggerCount: number;
  totalAdjustments: number;
  minSpending: number;
  maxSpending: number;
  spendingRange: number;
  avgSpendingAdjustment: number;
  finalPortfolio: number;
  portfolioLastsToAge: number;
  fundsLastToLifeExpectancy: boolean;
  baseSpending: number;
  finalSpending: number;
}

interface GuardrailsChartProps {
  years: GuardrailsYear[];
  summary: GuardrailsSummary;
  retirementAge: number;
  currentAge: number;
  lifeExpectancy: number;
}

export function GuardrailsChart({
  years,
  summary,
  retirementAge,
  currentAge,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lifeExpectancy: _lifeExpectancy,
}: GuardrailsChartProps) {
  // Transform data for chart
  const chartData = years.map((item) => ({
    age: item.age,
    year: item.year,
    portfolio: item.portfolio,
    spending: item.isRetired ? item.spending : null,
    baseSpending: item.isRetired ? summary.baseSpending : null,
    upperThreshold: item.isRetired ? item.upperThreshold : null,
    lowerThreshold: item.isRetired ? item.lowerThreshold : null,
    isRetired: item.isRetired,
    guardrailTriggered: item.guardrailTriggered,
    spendingAdjustment: item.spendingAdjustment,
  }));

  // Memoized tooltip render function to avoid creating new component on each render
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltip = useCallback((props: any) => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
      const data = years.find((d) => d.age === label);
      if (!data) return null;

      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="font-medium mb-2">
            Age {label} ({data.year})
            {data.isRetired && (
              <span className="ml-2 text-xs text-muted-foreground">Retired</span>
            )}
          </p>
          <div className="space-y-1 text-sm">
            <p>
              Portfolio: <span className="font-medium">{formatCurrency(data.portfolio)}</span>
            </p>
            {data.isRetired && (
              <>
                <p>
                  Spending: <span className="font-medium">{formatCurrency(data.spending)}</span>
                </p>
                {data.guardrailTriggered && (
                  <p className={cn(
                    "font-medium",
                    data.guardrailTriggered === "upper" ? "text-green-500" : "text-amber-500"
                  )}>
                    {data.guardrailTriggered === "upper" ? "+" : ""}
                    {formatCurrency(data.spendingAdjustment)} adjustment
                    ({data.guardrailTriggered === "upper" ? "upper" : "lower"} guardrail)
                  </p>
                )}
                <div className="text-xs text-muted-foreground pt-1 border-t border-border mt-1">
                  <p>Upper threshold: {formatCurrency(data.upperThreshold)}</p>
                  <p>Lower threshold: {formatCurrency(data.lowerThreshold)}</p>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  }, [years]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Upper Triggers</p>
                <p className="text-lg font-semibold">{summary.upperTriggerCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lower Triggers</p>
                <p className="text-lg font-semibold">{summary.lowerTriggerCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Spending Range</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(summary.minSpending)} - {formatCurrency(summary.maxSpending)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                summary.fundsLastToLifeExpectancy ? "bg-green-500/10" : "bg-red-500/10"
              )}>
                {summary.fundsLastToLifeExpectancy ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Funds Last To</p>
                <p className="text-lg font-semibold">
                  Age {summary.portfolioLastsToAge}
                  {summary.fundsLastToLifeExpectancy && "+"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Chart with Guardrails */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portfolio with Guardrails</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <defs>
                <linearGradient id="guardrailGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />

              <XAxis
                dataKey="age"
                tick={{ fill: "currentColor", fontSize: 12 }}
                tickLine={{ stroke: "currentColor" }}
                className="text-muted-foreground"
                tickFormatter={(value) => {
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
              />

              {/* Guardrail thresholds as area */}
              <Area
                type="monotone"
                dataKey="upperThreshold"
                stroke="none"
                fill="hsl(142, 76%, 36%)"
                fillOpacity={0.1}
                name="Upper Threshold"
                legendType="none"
              />
              <Area
                type="monotone"
                dataKey="lowerThreshold"
                stroke="none"
                fill="hsl(var(--background))"
                fillOpacity={1}
                name="Lower Threshold"
                legendType="none"
              />

              {/* Portfolio line */}
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={false}
                name="Portfolio"
              />

              {/* Threshold lines */}
              <Line
                type="monotone"
                dataKey="upperThreshold"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="Upper Threshold"
              />
              <Line
                type="monotone"
                dataKey="lowerThreshold"
                stroke="hsl(45, 93%, 47%)"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="Lower Threshold"
              />

              {/* Retirement marker */}
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
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Spending Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spending Adjustments Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart
              data={chartData.filter(d => d.isRetired)}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />

              <XAxis
                dataKey="age"
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

              <Tooltip
                formatter={(value) => formatCurrency(value as number)}
                labelFormatter={(label) => `Age ${label}`}
              />

              <Legend verticalAlign="top" height={36} />

              {/* Base spending reference */}
              <ReferenceLine
                y={summary.baseSpending}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                label={{
                  value: "Base",
                  position: "right",
                  fill: "currentColor",
                  fontSize: 10,
                }}
              />

              {/* Actual spending line */}
              <Line
                type="stepAfter"
                dataKey="spending"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Actual Spending"
              />

              {/* Highlight adjustment years */}
              <Bar
                dataKey="spendingAdjustment"
                fill="hsl(var(--primary))"
                name="Adjustment"
                opacity={0.3}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
