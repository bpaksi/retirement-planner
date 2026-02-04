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
import { formatCurrency, cn } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface OneTimeEvent {
  _id: Id<"oneTimeEvents">;
  name: string;
  year: number;
  amount: number;
  category?: string;
  notes?: string;
  createdAt: number;
}

const CATEGORIES = [
  { value: "travel", label: "Travel" },
  { value: "home", label: "Home Improvement" },
  { value: "vehicle", label: "Vehicle" },
  { value: "medical", label: "Medical" },
  { value: "education", label: "Education" },
  { value: "gift", label: "Gift / Inheritance" },
  { value: "other", label: "Other" },
];

interface FormData {
  name: string;
  year: string;
  amount: string;
  isExpense: boolean;
  category: string;
  notes: string;
}

const currentYear = new Date().getFullYear();

const initialFormData: FormData = {
  name: "",
  year: (currentYear + 1).toString(),
  amount: "",
  isExpense: true,
  category: "",
  notes: "",
};

export function OneTimeEventsList() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<Id<"oneTimeEvents"> | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  const events = useQuery(api.oneTimeEvents.queries.list);
  const createEvent = useMutation(api.oneTimeEvents.mutations.create);
  const updateEvent = useMutation(api.oneTimeEvents.mutations.update);
  const removeEvent = useMutation(api.oneTimeEvents.mutations.remove);

  const isLoading = events === undefined;

  const openCreateDialog = () => {
    setEditingId(null);
    setFormData(initialFormData);
    setShowDialog(true);
  };

  const openEditDialog = (event: OneTimeEvent) => {
    setEditingId(event._id);
    setFormData({
      name: event.name,
      year: event.year.toString(),
      amount: Math.abs(event.amount).toString(),
      isExpense: event.amount < 0,
      category: event.category ?? "",
      notes: event.notes ?? "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const amount = parseFloat(formData.amount) || 0;
      const data = {
        name: formData.name,
        year: parseInt(formData.year),
        amount: formData.isExpense ? -Math.abs(amount) : Math.abs(amount),
        category: formData.category || undefined,
        notes: formData.notes || undefined,
      };

      if (editingId) {
        await updateEvent({ id: editingId, ...data });
      } else {
        await createEvent(data);
      }

      setShowDialog(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: Id<"oneTimeEvents">) => {
    if (confirm("Are you sure you want to delete this event?")) {
      await removeEvent({ id });
    }
  };

  // Group events by year
  const eventsByYear =
    events?.reduce(
      (acc, event) => {
        const year = event.year;
        if (!acc[year]) acc[year] = [];
        acc[year].push(event);
        return acc;
      },
      {} as Record<number, OneTimeEvent[]>
    ) ?? {};

  const totalExpenses =
    events
      ?.filter((e) => e.amount < 0)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0) ?? 0;
  const totalIncome =
    events
      ?.filter((e) => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0) ?? 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">One-Time Events</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Large expenses or income in specific years
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
          ) : events?.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No one-time events yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add planned expenses like new car, travel, home repairs
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {Object.entries(eventsByYear)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([year, yearEvents]) => (
                    <div key={year}>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        {year}
                      </h4>
                      <div className="space-y-2">
                        {yearEvents.map((event) => (
                          <div
                            key={event._id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center",
                                  event.amount < 0
                                    ? "bg-red-500/10"
                                    : "bg-green-500/10"
                                )}
                              >
                                {event.amount < 0 ? (
                                  <TrendingDown className="w-4 h-4 text-red-500" />
                                ) : (
                                  <TrendingUp className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{event.name}</p>
                                {event.category && (
                                  <p className="text-xs text-muted-foreground">
                                    {CATEGORIES.find(
                                      (c) => c.value === event.category
                                    )?.label ?? event.category}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <p
                                className={cn(
                                  "font-semibold",
                                  event.amount < 0
                                    ? "text-red-500"
                                    : "text-green-500"
                                )}
                              >
                                {event.amount < 0 ? "-" : "+"}
                                {formatCurrency(Math.abs(event.amount))}
                              </p>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(event)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(event._id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Expenses</span>
                  <span className="font-semibold text-red-500">
                    -{formatCurrency(totalExpenses)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Income</span>
                  <span className="font-semibold text-green-500">
                    +{formatCurrency(totalIncome)}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)}>
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Edit Event" : "Add One-Time Event"}
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
                placeholder="e.g., New Car, Kitchen Renovation"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Year</label>
                <Input
                  type="number"
                  min={currentYear}
                  max={currentYear + 50}
                  value={formData.year}
                  onChange={(e) =>
                    setFormData({ ...formData, year: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Type</label>
                <Select
                  value={formData.isExpense ? "expense" : "income"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isExpense: e.target.value === "expense",
                    })
                  }
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Amount</label>
              <Input
                type="number"
                min="0"
                step="100"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="e.g., 30000"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Category
              </label>
              <Select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </Select>
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
            disabled={isSaving || !formData.name || !formData.amount}
          >
            {isSaving ? "Saving..." : editingId ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
