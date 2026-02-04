"use client";

import { ReactNode } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/Popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface MultiSelectGroup<T extends string = string> {
  label: string;
  options: MultiSelectOption<T>[];
}

interface MultiSelectPopoverProps<T extends string = string> {
  /** Flat list of options (mutually exclusive with groups) */
  options?: MultiSelectOption<T>[];
  /** Grouped options (mutually exclusive with options) */
  groups?: MultiSelectGroup<T>[];
  /** Currently selected values */
  value: T[];
  /** Called when selection changes */
  onChange: (value: T[]) => void;
  /** Placeholder text when nothing selected */
  placeholder: string;
  /** Optional custom icon for the trigger button */
  icon?: ReactNode;
  /** Additional class name for the trigger button */
  className?: string;
}

export function MultiSelectPopover<T extends string = string>({
  options,
  groups,
  value,
  onChange,
  placeholder,
  icon,
  className,
}: MultiSelectPopoverProps<T>) {
  const selectedSet = new Set(value);
  const hasSelection = value.length > 0;

  // Flatten groups to options if using groups
  const allOptions: MultiSelectOption<T>[] = groups
    ? groups.flatMap((g) => g.options)
    : options || [];

  const handleToggle = (optionValue: T) => {
    if (selectedSet.has(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  const renderOption = (option: MultiSelectOption<T>) => (
    <label
      key={option.value}
      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
    >
      <input
        type="checkbox"
        checked={selectedSet.has(option.value)}
        onChange={() => handleToggle(option.value)}
        className="rounded border-border"
      />
      {option.icon && (
        <span className="text-muted-foreground">{option.icon}</span>
      )}
      <span className="text-sm">{option.label}</span>
    </label>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={hasSelection ? "default" : "outline"}
          size="sm"
          className={cn("min-w-[100px] relative", className)}
        >
          {icon || <Filter className="w-4 h-4 mr-2" />}
          {placeholder}
          {hasSelection && (
            <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium rounded-full bg-primary-foreground text-primary">
              {value.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] max-h-[300px] overflow-y-auto p-2">
        <div className="space-y-1">
          {groups ? (
            // Render grouped options
            groups.map((group) => (
              <div key={group.label}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </div>
                {group.options.map(renderOption)}
              </div>
            ))
          ) : (
            // Render flat options
            allOptions.map(renderOption)
          )}
          {hasSelection && (
            <button
              onClick={handleClear}
              className="w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
