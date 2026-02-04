"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  DialogCloseButton,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ASSET_CLASS_CONFIG,
  ASSET_CLASSES,
  DEFAULT_REBALANCE_THRESHOLD,
  type AssetClass,
} from "@/lib/constants/investments";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2 } from "lucide-react";

interface TargetInput {
  assetClass: AssetClass;
  targetPercent: number;
  rebalanceThreshold: number;
}

interface AllocationTargetsDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (targets: TargetInput[]) => Promise<void>;
  existingTargets?: Array<{
    assetClass: string;
    targetPercent: number;
    rebalanceThreshold: number;
  }>;
  isAccountSpecific?: boolean;
  accountName?: string;
}

export function AllocationTargetsDialog({
  open,
  onClose,
  onSave,
  existingTargets = [],
  isAccountSpecific = false,
  accountName,
}: AllocationTargetsDialogProps) {
  const [targets, setTargets] = useState<Record<AssetClass, { percent: string; threshold: string }>>(() => {
    const initial: Record<AssetClass, { percent: string; threshold: string }> = {} as Record<AssetClass, { percent: string; threshold: string }>;
    for (const assetClass of ASSET_CLASSES) {
      const existing = existingTargets.find((t) => t.assetClass === assetClass);
      initial[assetClass] = {
        percent: existing ? (existing.targetPercent * 100).toString() : "0",
        threshold: existing
          ? (existing.rebalanceThreshold * 100).toString()
          : (DEFAULT_REBALANCE_THRESHOLD * 100).toString(),
      };
    }
    return initial;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset targets when dialog opens with new data
  useEffect(() => {
    if (open) {
      const initial: Record<AssetClass, { percent: string; threshold: string }> = {} as Record<AssetClass, { percent: string; threshold: string }>;
      for (const assetClass of ASSET_CLASSES) {
        const existing = existingTargets.find((t) => t.assetClass === assetClass);
        initial[assetClass] = {
          percent: existing ? (existing.targetPercent * 100).toString() : "0",
          threshold: existing
            ? (existing.rebalanceThreshold * 100).toString()
            : (DEFAULT_REBALANCE_THRESHOLD * 100).toString(),
        };
      }
      setTargets(initial);
      setError(null);
    }
  }, [open, existingTargets]);

  const totalPercent = useMemo(() => {
    return ASSET_CLASSES.reduce((sum, assetClass) => {
      const value = parseFloat(targets[assetClass]?.percent || "0");
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
  }, [targets]);

  const isValid = Math.abs(totalPercent - 100) < 0.1;

  const handlePercentChange = (assetClass: AssetClass, value: string) => {
    setTargets((prev) => ({
      ...prev,
      [assetClass]: { ...prev[assetClass], percent: value },
    }));
    setError(null);
  };

  const handleThresholdChange = (assetClass: AssetClass, value: string) => {
    setTargets((prev) => ({
      ...prev,
      [assetClass]: { ...prev[assetClass], threshold: value },
    }));
  };

  const handleSave = async () => {
    if (!isValid) {
      setError(`Percentages must sum to 100%. Current total: ${totalPercent.toFixed(1)}%`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const targetInputs: TargetInput[] = ASSET_CLASSES.map((assetClass) => ({
        assetClass,
        targetPercent: parseFloat(targets[assetClass].percent) / 100,
        rebalanceThreshold: parseFloat(targets[assetClass].threshold) / 100,
      }));

      await onSave(targetInputs);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save targets");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetEqual = () => {
    const equalPercent = (100 / ASSET_CLASSES.length).toFixed(1);
    const newTargets: Record<AssetClass, { percent: string; threshold: string }> = {} as Record<AssetClass, { percent: string; threshold: string }>;
    for (const assetClass of ASSET_CLASSES) {
      newTargets[assetClass] = {
        percent: equalPercent,
        threshold: targets[assetClass]?.threshold || (DEFAULT_REBALANCE_THRESHOLD * 100).toString(),
      };
    }
    setTargets(newTargets);
    setError(null);
  };

  const handleClearAll = () => {
    const newTargets: Record<AssetClass, { percent: string; threshold: string }> = {} as Record<AssetClass, { percent: string; threshold: string }>;
    for (const assetClass of ASSET_CLASSES) {
      newTargets[assetClass] = {
        percent: "0",
        threshold: (DEFAULT_REBALANCE_THRESHOLD * 100).toString(),
      };
    }
    setTargets(newTargets);
    setError(null);
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <DialogCloseButton onClose={onClose} />
      <DialogHeader>
        <DialogTitle>
          {isAccountSpecific && accountName
            ? `Set Targets for ${accountName}`
            : "Set Allocation Targets"}
        </DialogTitle>
        <DialogDescription>
          Set your target allocation percentages for each asset class. The
          threshold determines when you&apos;ll be alerted to rebalance.
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSetEqual}>
              Equal Split
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              Clear All
            </Button>
          </div>

          {/* Target inputs */}
          <div className="space-y-3">
            {ASSET_CLASSES.map((assetClass) => (
              <div
                key={assetClass}
                className="grid grid-cols-[1fr,100px,100px] gap-3 items-center"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        ASSET_CLASS_CONFIG[assetClass]?.color ?? "#6B7280",
                    }}
                  />
                  <span className="text-sm">
                    {ASSET_CLASS_CONFIG[assetClass]?.label ?? assetClass}
                  </span>
                </div>
                <div>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={targets[assetClass]?.percent || "0"}
                      onChange={(e) =>
                        handlePercentChange(assetClass, e.target.value)
                      }
                      className="pr-6 text-right"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
                <div>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      step="0.5"
                      value={targets[assetClass]?.threshold || "5"}
                      onChange={(e) =>
                        handleThresholdChange(assetClass, e.target.value)
                      }
                      className="pr-6 text-right"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      ±
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Column headers (after first row for better UX) */}
          <div className="grid grid-cols-[1fr,100px,100px] gap-3 text-xs text-muted-foreground">
            <span></span>
            <span className="text-center">Target %</span>
            <span className="text-center">Threshold</span>
          </div>

          {/* Total indicator */}
          <div
            className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              isValid ? "bg-green-500/10" : "bg-destructive/10"
            )}
          >
            <span className="font-medium">Total</span>
            <span
              className={cn(
                "font-mono text-lg",
                isValid ? "text-green-500" : "text-destructive"
              )}
            >
              {totalPercent.toFixed(1)}%
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!isValid || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Targets"
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
