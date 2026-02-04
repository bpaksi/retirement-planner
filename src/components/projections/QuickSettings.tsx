"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";
import { Pencil, Check, X } from "lucide-react";

interface QuickSettingsProps {
  retirementDate: number | null;
  currentAge: number | null;
  annualSpending: number | null;
  suggestedSpending: number;
  isSpendingAutoCalculated: boolean;
  onSave: (settings: {
    retirementDate: number;
    currentAge: number;
    annualSpending: number;
    isSpendingAutoCalculated: boolean;
  }) => void;
  isSaving?: boolean;
}

export function QuickSettings({
  retirementDate,
  currentAge,
  annualSpending,
  suggestedSpending,
  isSpendingAutoCalculated,
  onSave,
  isSaving = false,
}: QuickSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Local edit state
  const [editRetirementDate, setEditRetirementDate] = useState("");
  const [editCurrentAge, setEditCurrentAge] = useState("");
  const [editAnnualSpending, setEditAnnualSpending] = useState("");
  const [useAutoSpending, setUseAutoSpending] = useState(isSpendingAutoCalculated);

  // Initialize edit state and enter edit mode
  const handleStartEditing = () => {
    // Format date as YYYY-MM for input
    if (retirementDate) {
      const date = new Date(retirementDate);
      setEditRetirementDate(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      );
    } else {
      // Default to 5 years from now
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() + 5);
      setEditRetirementDate(
        `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, "0")}`
      );
    }

    setEditCurrentAge(currentAge?.toString() ?? "");
    setEditAnnualSpending(
      (annualSpending ?? suggestedSpending).toString()
    );
    setUseAutoSpending(isSpendingAutoCalculated);
    setIsEditing(true);
  };

  const handleSave = () => {
    // Parse the month input (YYYY-MM)
    const [year, month] = editRetirementDate.split("-").map(Number);
    const retireDate = new Date(year, month - 1, 1).getTime();

    const spending = useAutoSpending
      ? suggestedSpending
      : parseInt(editAnnualSpending, 10);

    onSave({
      retirementDate: retireDate,
      currentAge: parseInt(editCurrentAge, 10),
      annualSpending: spending,
      isSpendingAutoCalculated: useAutoSpending,
    });

    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  // Format retirement date for display
  const formatRetirementDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  // Show setup prompt if no data
  const hasData = retirementDate && currentAge && annualSpending;

  if (!hasData && !isEditing) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Set up your retirement profile to see projections
            </p>
            <Button onClick={handleStartEditing}>
              Get Started
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isEditing) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Edit Settings</h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !editRetirementDate || !editCurrentAge}
              >
                <Check className="w-4 h-4 mr-1" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Retirement Date */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Retirement Date
              </label>
              <Input
                type="month"
                value={editRetirementDate}
                onChange={(e) => setEditRetirementDate(e.target.value)}
              />
            </div>

            {/* Current Age */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Current Age
              </label>
              <Input
                type="number"
                min={18}
                max={100}
                value={editCurrentAge}
                onChange={(e) => setEditCurrentAge(e.target.value)}
                placeholder="e.g., 58"
              />
            </div>

            {/* Annual Spending */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Annual Spending
              </label>
              <div className="space-y-2">
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={editAnnualSpending}
                  onChange={(e) => {
                    setEditAnnualSpending(e.target.value);
                    setUseAutoSpending(false);
                  }}
                  placeholder="e.g., 60000"
                  disabled={useAutoSpending}
                />
                {suggestedSpending > 0 && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useAutoSpending}
                      onChange={(e) => {
                        setUseAutoSpending(e.target.checked);
                        if (e.target.checked) {
                          setEditAnnualSpending(suggestedSpending.toString());
                        }
                      }}
                      className="rounded"
                    />
                    Use auto-calculated ({formatCurrency(suggestedSpending)}/yr)
                  </label>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Quick Settings</h3>
          <Button variant="ghost" size="sm" onClick={handleStartEditing}>
            <Pencil className="w-4 h-4 mr-1" />
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Retirement Date</p>
            <p className="text-lg font-semibold">
              {retirementDate ? formatRetirementDate(retirementDate) : "-"}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Current Age</p>
            <p className="text-lg font-semibold">{currentAge ?? "-"}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              Annual Spending
              {isSpendingAutoCalculated && (
                <span
                  className="text-xs bg-muted px-1.5 py-0.5 rounded"
                  title="Auto-calculated from transaction history"
                >
                  auto
                </span>
              )}
            </p>
            <p className="text-lg font-semibold">
              {annualSpending ? formatCurrency(annualSpending) : "-"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
