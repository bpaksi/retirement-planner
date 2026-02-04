"use client";

import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

type Status = "on_track" | "at_risk" | "behind";

interface ReadinessStatusProps {
  status: Status;
  expectedRunsOutAge: number | null;
  optimisticRunsOutAge: number | null;
  pessimisticRunsOutAge: number | null;
  lifeExpectancy: number;
  className?: string;
}

const statusConfig: Record<
  Status,
  {
    label: string;
    description: string;
    icon: typeof CheckCircle;
    colorClasses: string;
    bgClasses: string;
  }
> = {
  on_track: {
    label: "On Track",
    description: "Funds expected to last through retirement",
    icon: CheckCircle,
    colorClasses: "text-green-500",
    bgClasses: "bg-green-500/10",
  },
  at_risk: {
    label: "At Risk",
    description: "Funds may run short in pessimistic scenarios",
    icon: AlertTriangle,
    colorClasses: "text-amber-500",
    bgClasses: "bg-amber-500/10",
  },
  behind: {
    label: "Behind",
    description: "Funds likely to run out before plan",
    icon: XCircle,
    colorClasses: "text-red-500",
    bgClasses: "bg-red-500/10",
  },
};

export function ReadinessStatus({
  status,
  expectedRunsOutAge,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  optimisticRunsOutAge: _optimisticRunsOutAge,
  pessimisticRunsOutAge,
  lifeExpectancy,
  className,
}: ReadinessStatusProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  // Generate detailed message based on scenario
  const getMessage = () => {
    if (status === "on_track") {
      return `Your funds are projected to last beyond age ${lifeExpectancy}.`;
    }

    if (status === "at_risk") {
      const runsOutAge = expectedRunsOutAge ?? pessimisticRunsOutAge;
      if (runsOutAge) {
        return `Funds may run out around age ${runsOutAge} in the expected scenario.`;
      }
      return config.description;
    }

    // Behind
    if (pessimisticRunsOutAge) {
      return `Funds projected to run out around age ${pessimisticRunsOutAge} even in optimistic scenarios.`;
    }
    return config.description;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg",
        config.bgClasses,
        className
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          config.bgClasses
        )}
      >
        <Icon className={cn("w-5 h-5", config.colorClasses)} />
      </div>
      <div className="flex-1">
        <p className={cn("font-semibold", config.colorClasses)}>
          {config.label}
        </p>
        <p className="text-sm text-muted-foreground">{getMessage()}</p>
      </div>
    </div>
  );
}

// Compact version for cards
export function ReadinessStatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium",
        config.bgClasses,
        config.colorClasses,
        className
      )}
    >
      <Icon className="w-4 h-4" />
      {config.label}
    </div>
  );
}
