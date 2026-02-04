"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from "@/components/ui/Dialog";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, DollarSign, Loader2 } from "lucide-react";

type IncomeSourceType =
  | "salary"
  | "self_employment"
  | "social_security"
  | "pension"
  | "rental"
  | "dividends"
  | "other";

interface IncomeSource {
  _id: Id<"incomeSources">;
  type: IncomeSourceType;
  name: string;
  annualAmount: number;
  startDate?: number;
  endDate?: number;
  growthRate: number;
  isTaxable: boolean;
  createdAt: number;
}

const TYPE_LABELS: Record<IncomeSourceType, string> = {
  social_security: "Social Security",
  pension: "Pension",
  salary: "Salary",
  self_employment: "Self-Employment",
  rental: "Rental Income",
  dividends: "Dividends",
  other: "Other",
};

const TYPE_COLORS: Record<IncomeSourceType, string> = {
  social_security: "bg-blue-500/10 text-blue-500",
  pension: "bg-purple-500/10 text-purple-500",
  salary: "bg-green-500/10 text-green-500",
  self_employment: "bg-amber-500/10 text-amber-500",
  rental: "bg-cyan-500/10 text-cyan-500",
  dividends: "bg-pink-500/10 text-pink-500",
  other: "bg-gray-500/10 text-gray-500",
};

interface FormData {
  type: IncomeSourceType;
  name: string;
  annualAmount: string;
  startDate: string;
  endDate: string;
  growthRate: string;
  isTaxable: boolean;
}

const initialFormData: FormData = {
  type: "social_security",
  name: "",
  annualAmount: "",
  startDate: "",
  endDate: "",
  growthRate: "0",
  isTaxable: true,
};

export function IncomeSourcesList() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<Id<"incomeSources"> | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  const incomeSources = useQuery(api.incomeSources.queries.list);
  const createSource = useMutation(api.incomeSources.mutations.create);
  const updateSource = useMutation(api.incomeSources.mutations.update);
  const removeSource = useMutation(api.incomeSources.mutations.remove);

  const isLoading = incomeSources === undefined;

  const openCreateDialog = () => {
    setEditingId(null);
    setFormData(initialFormData);
    setShowDialog(true);
  };

  const openEditDialog = (source: IncomeSource) => {
    setEditingId(source._id);
    setFormData({
      type: source.type,
      name: source.name,
      annualAmount: source.annualAmount.toString(),
      startDate: source.startDate
        ? new Date(source.startDate).toISOString().split("T")[0]
        : "",
      endDate: source.endDate
        ? new Date(source.endDate).toISOString().split("T")[0]
        : "",
      growthRate: (source.growthRate * 100).toString(),
      isTaxable: source.isTaxable,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = {
        type: formData.type,
        name: formData.name,
        annualAmount: parseFloat(formData.annualAmount) || 0,
        startDate: formData.startDate
          ? new Date(formData.startDate).getTime()
          : undefined,
        endDate: formData.endDate
          ? new Date(formData.endDate).getTime()
          : undefined,
        growthRate: (parseFloat(formData.growthRate) || 0) / 100,
        isTaxable: formData.isTaxable,
      };

      if (editingId) {
        await updateSource({ id: editingId, ...data });
      } else {
        await createSource(data);
      }

      setShowDialog(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: Id<"incomeSources">) => {
    if (confirm("Are you sure you want to delete this income source?")) {
      await removeSource({ id });
    }
  };

  const totalAnnualIncome =
    incomeSources?.reduce((sum, s) => sum + s.annualAmount, 0) ?? 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">Income Sources</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Social Security, pensions, and other retirement income
            </p>
          </div>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : incomeSources?.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No income sources yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add Social Security, pensions, or other income
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {incomeSources?.map((source) => (
                  <div
                    key={source._id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${TYPE_COLORS[source.type]}`}
                      >
                        {TYPE_LABELS[source.type]}
                      </span>
                      <div>
                        <p className="font-medium">{source.name}</p>
                        {source.startDate && (
                          <p className="text-xs text-muted-foreground">
                            Starts{" "}
                            {new Date(source.startDate).toLocaleDateString(
                              "en-US",
                              { month: "short", year: "numeric" }
                            )}
                            {source.endDate &&
                              ` - Ends ${new Date(source.endDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-semibold">
                        {formatCurrency(source.annualAmount)}
                        <span className="text-xs text-muted-foreground">
                          /yr
                        </span>
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(source)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(source._id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Total Annual Income
                </span>
                <span className="font-semibold text-lg">
                  {formatCurrency(totalAnnualIncome)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)}>
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Edit Income Source" : "Add Income Source"}
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Type</label>
              <Select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as IncomeSourceType,
                  })
                }
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., My Social Security"
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
                placeholder="e.g., 24000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  When income begins
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  End Date
                </label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank for lifetime
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Annual Growth Rate (%)
              </label>
              <Input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={formData.growthRate}
                onChange={(e) =>
                  setFormData({ ...formData, growthRate: e.target.value })
                }
                placeholder="e.g., 2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                COLA or expected annual increase
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isTaxable"
                checked={formData.isTaxable}
                onChange={(e) =>
                  setFormData({ ...formData, isTaxable: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="isTaxable" className="text-sm">
                Taxable income
              </label>
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
