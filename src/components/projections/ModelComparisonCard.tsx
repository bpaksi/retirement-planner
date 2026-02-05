"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Shield,
  Dices,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export type ModelType = "standard" | "guardrails" | "montecarlo";

interface ModelComparisonCardProps {
  type: ModelType;
  status: "success" | "warning" | "danger" | "neutral";
  title: string;
  subtitle?: string;
  primaryMetric: {
    label: string;
    value: string;
  };
  secondaryMetrics?: Array<{
    label: string;
    value: string;
    trend?: "up" | "down" | "neutral";
  }>;
  isEnabled?: boolean;
  onClick?: () => void;
}

const modelConfig: Record<
  ModelType,
  {
    icon: React.ReactNode;
    color: string;
    bgColor: string;
  }
> = {
  standard: {
    icon: <LineChart className="w-5 h-5" />,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  guardrails: {
    icon: <Shield className="w-5 h-5" />,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  montecarlo: {
    icon: <Dices className="w-5 h-5" />,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
};

const statusConfig: Record<
  string,
  {
    icon: React.ReactNode;
    color: string;
    borderColor: string;
    bgColor: string;
  }
> = {
  success: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "text-green-500",
    borderColor: "border-green-500/30",
    bgColor: "bg-green-500/5",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-yellow-500",
    borderColor: "border-yellow-500/30",
    bgColor: "bg-yellow-500/5",
  },
  danger: {
    icon: <XCircle className="w-4 h-4" />,
    color: "text-red-500",
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/5",
  },
  neutral: {
    icon: null,
    color: "text-muted-foreground",
    borderColor: "border-border",
    bgColor: "",
  },
};

export function ModelComparisonCard({
  type,
  status,
  title,
  subtitle,
  primaryMetric,
  secondaryMetrics,
  isEnabled = true,
  onClick,
}: ModelComparisonCardProps) {
  const model = modelConfig[type];
  const statusInfo = statusConfig[status];

  return (
    <Card
      className={cn(
        "transition-all",
        statusInfo.borderColor,
        statusInfo.bgColor,
        !isEnabled && "opacity-50",
        onClick && "cursor-pointer hover:shadow-md"
      )}
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", model.bgColor, model.color)}>
              {model.icon}
            </div>
            <div>
              <h3 className="font-medium text-sm">{title}</h3>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {statusInfo.icon && (
            <div className={statusInfo.color}>{statusInfo.icon}</div>
          )}
        </div>

        {/* Primary Metric */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground">{primaryMetric.label}</p>
          <p className={cn("text-2xl font-bold", statusInfo.color)}>
            {primaryMetric.value}
          </p>
        </div>

        {/* Secondary Metrics */}
        {secondaryMetrics && secondaryMetrics.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border">
            {secondaryMetrics.map((metric, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{metric.label}</span>
                <span className="flex items-center gap-1 font-medium">
                  {metric.trend === "up" && (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  )}
                  {metric.trend === "down" && (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Disabled state */}
        {!isEnabled && (
          <div className="text-center py-2">
            <span className="text-xs text-muted-foreground">Not enabled</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Convenience function to determine status from various metrics
export function getStatusFromSuccessRate(rate: number): "success" | "warning" | "danger" {
  if (rate >= 0.9) return "success";
  if (rate >= 0.7) return "warning";
  return "danger";
}

export function getStatusFromReadiness(
  status: "on_track" | "at_risk" | "behind"
): "success" | "warning" | "danger" {
  switch (status) {
    case "on_track":
      return "success";
    case "at_risk":
      return "warning";
    case "behind":
      return "danger";
  }
}
