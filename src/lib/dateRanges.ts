import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  startOfQuarter,
  endOfQuarter,
} from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
}

export type PresetKey =
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "last3Months"
  | "last6Months"
  | "thisYear"
  | "lastYear"
  | "allTime";

export interface PresetOption {
  key: PresetKey;
  label: string;
}

export const THIS_PERIOD_PRESETS: PresetOption[] = [
  { key: "thisMonth", label: "This Month" },
  { key: "thisQuarter", label: "This Quarter" },
  { key: "thisYear", label: "This Year" },
];

export const LAST_PERIOD_PRESETS: PresetOption[] = [
  { key: "lastMonth", label: "Last Month" },
  { key: "last3Months", label: "Last 3 Months" },
  { key: "last6Months", label: "Last 6 Months" },
  { key: "lastYear", label: "Last Year" },
];

export function getPresetRange(preset: PresetKey): DateRange | undefined {
  const now = new Date();

  switch (preset) {
    case "thisMonth":
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
      };

    case "lastMonth": {
      const lastMonth = subMonths(now, 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    }

    case "thisQuarter":
      return {
        from: startOfQuarter(now),
        to: endOfQuarter(now),
      };

    case "last3Months": {
      const threeMonthsAgo = subMonths(now, 3);
      return {
        from: startOfMonth(threeMonthsAgo),
        to: endOfMonth(subMonths(now, 1)),
      };
    }

    case "last6Months": {
      const sixMonthsAgo = subMonths(now, 6);
      return {
        from: startOfMonth(sixMonthsAgo),
        to: endOfMonth(subMonths(now, 1)),
      };
    }

    case "thisYear":
      return {
        from: startOfYear(now),
        to: endOfYear(now),
      };

    case "lastYear": {
      const lastYear = subYears(now, 1);
      return {
        from: startOfYear(lastYear),
        to: endOfYear(lastYear),
      };
    }

    case "allTime":
      return undefined;

    default:
      return undefined;
  }
}

export function getQuarterRange(
  year: number,
  quarter: 1 | 2 | 3 | 4
): DateRange {
  const startMonth = (quarter - 1) * 3;
  const quarterStart = new Date(year, startMonth, 1);
  return {
    from: quarterStart,
    to: endOfMonth(new Date(year, startMonth + 2, 1)),
  };
}

export function getCurrentQuarter(): 1 | 2 | 3 | 4 {
  return (Math.floor(new Date().getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

export function getQuarterLabel(quarter: 1 | 2 | 3 | 4): string {
  return `Q${quarter}`;
}

export function formatRangeLabel(range: DateRange | undefined): string {
  if (!range) return "All Time";

  const now = new Date();
  const currentYear = now.getFullYear();

  // Check if it matches a preset
  for (const preset of [...THIS_PERIOD_PRESETS, ...LAST_PERIOD_PRESETS]) {
    const presetRange = getPresetRange(preset.key);
    if (presetRange && rangesEqual(range, presetRange)) {
      return preset.label;
    }
  }

  // Check if it matches a quarter
  for (const year of [currentYear, currentYear - 1]) {
    for (const q of [1, 2, 3, 4] as const) {
      const quarterRange = getQuarterRange(year, q);
      if (rangesEqual(range, quarterRange)) {
        return `Q${q} ${year}`;
      }
    }
  }

  return "Custom";
}

function rangesEqual(a: DateRange, b: DateRange): boolean {
  return (
    a.from.getTime() === b.from.getTime() && a.to.getTime() === b.to.getTime()
  );
}
