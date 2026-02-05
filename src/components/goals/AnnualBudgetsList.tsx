"use client";

import { useState, useEffect } from "react";
import { fetchAnnualBudgets } from "@/app/actions/data";
import type { AnnualBudget } from "@/db/queries/annualBudgets";
import {
  createAnnualBudget,
  updateAnnualBudget,
  deleteAnnualBudget,
} from "@/app/actions/annualBudgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from "@/components/ui/Dialog";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, Wallet, Loader2 } from "lucide-react";

interface FormData {
  name: string;
  annualAmount: string;
  startYear: string;
  endYear: string;
  notes: string;
}

const currentYear = new Date().getFullYear();

const initialFormData: FormData = {
  name: "",
  annualAmount: "",
  startYear: "",
  endYear: "",
  notes: "",
};

// Suggested budget categories
const SUGGESTIONS = [
  { name: "Travel", amount: 8000 },
  { name: "Charitable Giving", amount: 5000 },
  { name: "Hobbies", amount: 3000 },
  { name: "Entertainment", amount: 2400 },
  { name: "Gifts", amount: 2000 },
];

export function AnnualBudgetsList() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [budgets, setBudgets] = useState<AnnualBudget[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAnnualBudgets();
      setBudgets(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateDialog = (suggestion?: { name: string; amount: number }) => {
    setEditingId(null);
    setFormData(
      suggestion
        ? {
            ...initialFormData,
            name: suggestion.name,
            annualAmount: suggestion.amount.toString(),
          }
        : initialFormData
    );
    setShowDialog(true);
  };

  const openEditDialog = (budget: AnnualBudget) => {
    setEditingId(budget.id);
    setFormData({
      name: budget.name,
      annualAmount: budget.annualAmount.toString(),
      startYear: budget.startYear?.toString() ?? "",
      endYear: budget.endYear?.toString() ?? "",
      notes: budget.notes ?? "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = {
        name: formData.name,
        annualAmount: parseFloat(formData.annualAmount) || 0,
        startYear: formData.startYear
          ? parseInt(formData.startYear)
          : undefined,
        endYear: formData.endYear ? parseInt(formData.endYear) : undefined,
        notes: formData.notes || undefined,
      };

      if (editingId) {
        await updateAnnualBudget({ id: editingId, ...data });
      } else {
        await createAnnualBudget(data);
      }

      setShowDialog(false);
      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this budget item?")) {
      await deleteAnnualBudget(id);
      await loadData();
    }
  };

  const totalAnnualBudget =
    budgets?.reduce((sum, b) => sum + b.annualAmount, 0) ?? 0;

  // Filter suggestions to only show ones not already added
  const existingNames = new Set(budgets?.map((b) => b.name.toLowerCase()) ?? []);
  const availableSuggestions = SUGGESTIONS.filter(
    (s) => !existingNames.has(s.name.toLowerCase())
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">Annual Budgets</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Additional spending categories beyond base expenses
            </p>
          </div>
          <Button size="sm" onClick={() => openCreateDialog()}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : budgets?.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No annual budgets yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Add discretionary spending categories for retirement
              </p>
              {availableSuggestions.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {availableSuggestions.slice(0, 3).map((suggestion) => (
                    <Button
                      key={suggestion.name}
                      variant="outline"
                      size="sm"
                      onClick={() => openCreateDialog(suggestion)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {suggestion.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {budgets?.map((budget) => (
                  <div
                    key={budget.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{budget.name}</p>
                      {(budget.startYear || budget.endYear) && (
                        <p className="text-xs text-muted-foreground">
                          {budget.startYear && `From ${budget.startYear}`}
                          {budget.startYear && budget.endYear && " - "}
                          {budget.endYear && `Until ${budget.endYear}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-semibold">
                        {formatCurrency(budget.annualAmount)}
                        <span className="text-xs text-muted-foreground">
                          /yr
                        </span>
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(budget)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(budget.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick add suggestions */}
              {availableSuggestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {availableSuggestions.slice(0, 3).map((suggestion) => (
                    <Button
                      key={suggestion.name}
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => openCreateDialog(suggestion)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {suggestion.name}
                    </Button>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Total Annual Budget
                </span>
                <span className="font-semibold text-lg">
                  {formatCurrency(totalAnnualBudget)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)}>
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Edit Annual Budget" : "Add Annual Budget"}
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Travel, Charitable Giving"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Annual Amount
              </label>
              <Input
                type="number"
                min="0"
                step="100"
                value={formData.annualAmount}
                onChange={(e) =>
                  setFormData({ ...formData, annualAmount: e.target.value })
                }
                placeholder="e.g., 8000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Start Year
                </label>
                <Input
                  type="number"
                  min={currentYear}
                  max={currentYear + 50}
                  value={formData.startYear}
                  onChange={(e) =>
                    setFormData({ ...formData, startYear: e.target.value })
                  }
                  placeholder="Optional"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank to start at retirement
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  End Year
                </label>
                <Input
                  type="number"
                  min={currentYear}
                  max={currentYear + 50}
                  value={formData.endYear}
                  onChange={(e) =>
                    setFormData({ ...formData, endYear: e.target.value })
                  }
                  placeholder="Optional"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank for ongoing
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Input
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Optional notes..."
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !formData.name || !formData.annualAmount}
          >
            {isSaving ? "Saving..." : editingId ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
