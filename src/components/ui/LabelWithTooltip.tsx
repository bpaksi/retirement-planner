"use client";

import { ReactNode } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LabelWithTooltipProps {
  label: string;
  tooltip: ReactNode;
  htmlFor?: string;
  className?: string;
  tooltipSide?: "top" | "bottom" | "left" | "right";
  required?: boolean;
}

export function LabelWithTooltip({
  label,
  tooltip,
  htmlFor,
  className,
  tooltipSide = "top",
  required = false,
}: LabelWithTooltipProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-muted-foreground"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <Tooltip content={tooltip} side={tooltipSide}>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Help for ${label}`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}
