"use client";

import { Link2, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";

interface LinkStatusIndicatorProps {
  isLinked: boolean;
  linkedAccountName: string | null;
  onClick: () => void;
  className?: string;
}

export function LinkStatusIndicator({
  isLinked,
  linkedAccountName,
  onClick,
  className,
}: LinkStatusIndicatorProps) {
  if (isLinked) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "p-1 rounded hover:bg-muted transition-colors group relative",
          className
        )}
        title={`Linked to ${linkedAccountName || "another account"}`}
        aria-label={`Linked transfer - click to view or unlink`}
      >
        <Link2 className="w-4 h-4 text-primary" />
        {/* Tooltip */}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
          Linked to {linkedAccountName || "another account"}
        </span>
      </button>
    );
  }

  // Not linked - show button to search for matches
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-1 rounded hover:bg-muted transition-colors opacity-40 hover:opacity-100",
        className
      )}
      title="Link to transfer"
      aria-label="Click to link this transaction to a transfer"
    >
      <Link2Off className="w-4 h-4" />
    </button>
  );
}
