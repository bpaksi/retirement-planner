"use client";

import { cn } from "@/lib/utils";
import { Id } from "../../../convex/_generated/dataModel";

interface Category {
  _id: Id<"categories">;
  name: string;
  type: "expense" | "income" | "transfer";
  isEssential: boolean;
  color: string;
}

interface CategoryPickerProps {
  categories: Category[];
  onSelect: (categoryId: Id<"categories">) => void;
  selectedId?: Id<"categories">;
}

interface GroupedCategories {
  income: Category[];
  essentialExpenses: Category[];
  discretionaryExpenses: Category[];
  transfers: Category[];
}

function groupCategories(categories: Category[]): GroupedCategories {
  return {
    income: categories.filter((c) => c.type === "income"),
    essentialExpenses: categories.filter(
      (c) => c.type === "expense" && c.isEssential
    ),
    discretionaryExpenses: categories.filter(
      (c) => c.type === "expense" && !c.isEssential
    ),
    transfers: categories.filter((c) => c.type === "transfer"),
  };
}

interface CategoryGroupProps {
  label: string;
  categories: Category[];
  onSelect: (categoryId: Id<"categories">) => void;
  selectedId?: Id<"categories">;
}

function CategoryGroup({
  label,
  categories,
  onSelect,
  selectedId,
}: CategoryGroupProps) {
  if (categories.length === 0) return null;

  return (
    <div className="py-1">
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      {categories.map((category) => (
        <button
          key={category._id}
          onClick={() => onSelect(category._id)}
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors text-left",
            selectedId === category._id && "bg-accent"
          )}
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: category.color }}
          />
          <span className="truncate">{category.name}</span>
        </button>
      ))}
    </div>
  );
}

export function CategoryPicker({
  categories,
  onSelect,
  selectedId,
}: CategoryPickerProps) {
  const grouped = groupCategories(categories);

  return (
    <div className="max-h-[300px] overflow-y-auto">
      <CategoryGroup
        label="Discretionary Expenses"
        categories={grouped.discretionaryExpenses}
        onSelect={onSelect}
        selectedId={selectedId}
      />
      <CategoryGroup
        label="Essential Expenses"
        categories={grouped.essentialExpenses}
        onSelect={onSelect}
        selectedId={selectedId}
      />
      <CategoryGroup
        label="Income"
        categories={grouped.income}
        onSelect={onSelect}
        selectedId={selectedId}
      />
      <CategoryGroup
        label="Transfers"
        categories={grouped.transfers}
        onSelect={onSelect}
        selectedId={selectedId}
      />
    </div>
  );
}
