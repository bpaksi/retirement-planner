"use client";

import * as React from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, X, ChevronLeft, ChevronRight } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
  getPresetRange,
  getQuarterRange,
  formatRangeLabel,
  THIS_PERIOD_PRESETS,
  LAST_PERIOD_PRESETS,
  PresetKey,
} from "@/lib/dateRanges";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface MonthYearPickerProps {
  label: string;
  value: { month: number; year: number } | null;
  onChange: (month: number, year: number) => void;
  minDate?: { month: number; year: number };
  maxDate?: { month: number; year: number };
}

function MonthYearPicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
}: MonthYearPickerProps) {
  const currentYear = new Date().getFullYear();
  const [displayYear, setDisplayYear] = React.useState(
    value?.year ?? currentYear
  );

  const isMonthDisabled = (month: number) => {
    if (minDate) {
      if (displayYear < minDate.year) return true;
      if (displayYear === minDate.year && month < minDate.month) return true;
    }
    if (maxDate) {
      if (displayYear > maxDate.year) return true;
      if (displayYear === maxDate.year && month > maxDate.month) return true;
    }
    return false;
  };

  const canGoBack = !minDate || displayYear > minDate.year;
  const canGoForward = !maxDate || displayYear < maxDate.year;

  return (
    <div className="flex-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        {label}
      </p>
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setDisplayYear((y) => y - 1)}
          disabled={!canGoBack}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{displayYear}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setDisplayYear((y) => y + 1)}
          disabled={!canGoForward}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {MONTHS.map((monthName, index) => {
          const isSelected =
            value?.month === index && value?.year === displayYear;
          const disabled = isMonthDisabled(index);

          return (
            <Button
              key={monthName}
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-8 text-xs",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              disabled={disabled}
              onClick={() => onChange(index, displayYear)}
            >
              {monthName}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  // Custom range state
  const [fromSelection, setFromSelection] = React.useState<{
    month: number;
    year: number;
  } | null>(null);
  const [toSelection, setToSelection] = React.useState<{
    month: number;
    year: number;
  } | null>(null);

  // Sync custom state when popover opens with existing value
  React.useEffect(() => {
    if (open && value?.from && value?.to) {
      setFromSelection({
        month: value.from.getMonth(),
        year: value.from.getFullYear(),
      });
      setToSelection({
        month: value.to.getMonth(),
        year: value.to.getFullYear(),
      });
    } else if (open) {
      setFromSelection(null);
      setToSelection(null);
    }
  }, [open, value]);

  const handlePresetSelect = (preset: PresetKey) => {
    const range = getPresetRange(preset);
    onChange?.(range);
    setOpen(false);
  };

  const handleQuarterSelect = (year: number, quarter: 1 | 2 | 3 | 4) => {
    const range = getQuarterRange(year, quarter);
    onChange?.({ from: range.from, to: range.to });
    setOpen(false);
  };

  const handleFromChange = (month: number, year: number) => {
    setFromSelection({ month, year });
    // If to is before from, clear it
    if (toSelection) {
      const fromDate = new Date(year, month);
      const toDate = new Date(toSelection.year, toSelection.month);
      if (toDate < fromDate) {
        setToSelection(null);
      }
    }
  };

  const handleToChange = (month: number, year: number) => {
    setToSelection({ month, year });
  };

  const handleApplyCustom = () => {
    if (fromSelection && toSelection) {
      const from = startOfMonth(
        new Date(fromSelection.year, fromSelection.month)
      );
      const to = endOfMonth(new Date(toSelection.year, toSelection.month));
      onChange?.({ from, to });
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(undefined);
    setFromSelection(null);
    setToSelection(null);
  };

  const getDisplayLabel = () => {
    if (!value?.from) return placeholder;
    if (!value.to) return format(value.from, "MMM d, yyyy");

    const label = formatRangeLabel({ from: value.from, to: value.to });
    if (label !== "Custom") {
      return label;
    }

    return `${format(value.from, "MMM d, yyyy")} – ${format(value.to, "MMM d, yyyy")}`;
  };

  const canApply = fromSelection !== null && toSelection !== null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="flex-1">{getDisplayLabel()}</span>
          {value?.from && (
            <X
              className="ml-2 h-4 w-4 opacity-50 hover:opacity-100 cursor-pointer"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Tabs defaultValue="presets" className="w-full">
          <div className="border-b border-border px-3 pt-3">
            <TabsList className="w-full">
              <TabsTrigger value="presets" className="flex-1">
                Presets
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex-1">
                Custom
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="presets" className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* This Period Column */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  This Period
                </p>
                <div className="space-y-1">
                  {THIS_PERIOD_PRESETS.map((preset) => (
                    <Button
                      key={preset.key}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handlePresetSelect(preset.key)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Last Period Column */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Last Period
                </p>
                <div className="space-y-1">
                  {LAST_PERIOD_PRESETS.map((preset) => (
                    <Button
                      key={preset.key}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handlePresetSelect(preset.key)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quarters */}
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Quarters ({currentYear})
              </p>
              <div className="flex gap-2">
                {([1, 2, 3, 4] as const).map((q) => (
                  <Button
                    key={`${currentYear}-q${q}`}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleQuarterSelect(currentYear, q)}
                  >
                    Q{q}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Quarters ({lastYear})
              </p>
              <div className="flex gap-2">
                {([1, 2, 3, 4] as const).map((q) => (
                  <Button
                    key={`${lastYear}-q${q}`}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleQuarterSelect(lastYear, q)}
                  >
                    Q{q}
                  </Button>
                ))}
              </div>
            </div>

            {/* All Time */}
            <div className="pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => handlePresetSelect("allTime")}
              >
                All Time
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="p-4">
            <div className="flex gap-6">
              <MonthYearPicker
                label="From"
                value={fromSelection}
                onChange={handleFromChange}
              />
              <MonthYearPicker
                label="To"
                value={toSelection}
                onChange={handleToChange}
                minDate={fromSelection ?? undefined}
              />
            </div>

            {/* Selection summary and apply */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {fromSelection && toSelection ? (
                  <>
                    {MONTHS[fromSelection.month]} {fromSelection.year} –{" "}
                    {MONTHS[toSelection.month]} {toSelection.year}
                  </>
                ) : fromSelection ? (
                  <>
                    {MONTHS[fromSelection.month]} {fromSelection.year} – Select
                    end
                  </>
                ) : (
                  "Select start and end months"
                )}
              </p>
              <Button size="sm" disabled={!canApply} onClick={handleApplyCustom}>
                Apply
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
