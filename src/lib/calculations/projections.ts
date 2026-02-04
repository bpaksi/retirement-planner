// Default projection assumptions
export const PROJECTION_DEFAULTS = {
  expectedReturn: 0.05, // 5% real
  optimisticReturn: 0.07, // 7% real
  pessimisticReturn: 0.03, // 3% real
  lifeExpectancy: 95,
  inflation: 0.03, // 3% (baked into "real" returns)
};

export interface ProjectionYear {
  year: number;
  age: number;
  expected: number;
  optimistic: number;
  pessimistic: number;
  isRetired: boolean;
  income?: number;
  spending?: number;
  oneTimeEvent?: number;
}

export interface ProjectionInputs {
  currentNetWorth: number;
  annualSpending: number;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy?: number;
  expectedReturn?: number;
  optimisticReturn?: number;
  pessimisticReturn?: number;
}

export interface ProjectionResult {
  years: ProjectionYear[];
  status: "on_track" | "at_risk" | "behind";
  expectedRunsOutAge: number | null;
  optimisticRunsOutAge: number | null;
  pessimisticRunsOutAge: number | null;
  projectedNetWorthAtRetirement: number;
  yearsUntilRetirement: number;
}

export function calculateProjection(inputs: ProjectionInputs): ProjectionResult {
  const lifeExpectancy = inputs.lifeExpectancy ?? PROJECTION_DEFAULTS.lifeExpectancy;
  const expectedReturn = inputs.expectedReturn ?? PROJECTION_DEFAULTS.expectedReturn;
  const optimisticReturn = inputs.optimisticReturn ?? PROJECTION_DEFAULTS.optimisticReturn;
  const pessimisticReturn = inputs.pessimisticReturn ?? PROJECTION_DEFAULTS.pessimisticReturn;

  const years: ProjectionYear[] = [];

  let expected = inputs.currentNetWorth;
  let optimistic = inputs.currentNetWorth;
  let pessimistic = inputs.currentNetWorth;

  const currentYear = new Date().getFullYear();

  // Track when funds run out in each scenario
  let expectedRunsOutAge: number | null = null;
  let optimisticRunsOutAge: number | null = null;
  let pessimisticRunsOutAge: number | null = null;

  for (let age = inputs.currentAge; age <= lifeExpectancy; age++) {
    const year = currentYear + (age - inputs.currentAge);
    const isRetired = age >= inputs.retirementAge;

    // Apply returns (real returns)
    expected *= 1 + expectedReturn;
    optimistic *= 1 + optimisticReturn;
    pessimistic *= 1 + pessimisticReturn;

    // Subtract spending if retired
    if (isRetired) {
      expected -= inputs.annualSpending;
      optimistic -= inputs.annualSpending;
      pessimistic -= inputs.annualSpending;
    }

    // Track when funds run out
    if (expected <= 0 && expectedRunsOutAge === null) {
      expectedRunsOutAge = age;
    }
    if (optimistic <= 0 && optimisticRunsOutAge === null) {
      optimisticRunsOutAge = age;
    }
    if (pessimistic <= 0 && pessimisticRunsOutAge === null) {
      pessimisticRunsOutAge = age;
    }

    years.push({
      year,
      age,
      expected: Math.max(0, Math.round(expected)),
      optimistic: Math.max(0, Math.round(optimistic)),
      pessimistic: Math.max(0, Math.round(pessimistic)),
      isRetired,
    });
  }

  // Calculate readiness status
  let status: "on_track" | "at_risk" | "behind";

  if (expectedRunsOutAge === null) {
    status = "on_track";
  } else if (optimisticRunsOutAge === null) {
    status = "at_risk";
  } else {
    status = "behind";
  }

  // Calculate projected net worth at retirement
  const retirementYear = years.find((y) => y.age === inputs.retirementAge);
  const projectedNetWorthAtRetirement = retirementYear?.expected ?? 0;

  // Calculate years until retirement
  const yearsUntilRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge);

  return {
    years,
    status,
    expectedRunsOutAge,
    optimisticRunsOutAge,
    pessimisticRunsOutAge,
    projectedNetWorthAtRetirement,
    yearsUntilRetirement,
  };
}

// Calculate retirement age from retirement date
export function calculateRetirementAge(
  retirementDate: Date | number,
  currentAge: number
): number {
  const retireDate = typeof retirementDate === "number" ? new Date(retirementDate) : retirementDate;
  const now = new Date();

  // Calculate years until retirement
  const yearsUntil = (retireDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

  return Math.round(currentAge + yearsUntil);
}

// Format years until retirement as a readable string
export function formatTimeUntilRetirement(yearsUntil: number): string {
  if (yearsUntil <= 0) {
    return "Retired";
  }

  const years = Math.floor(yearsUntil);
  const months = Math.round((yearsUntil - years) * 12);

  if (years === 0) {
    return `${months} month${months !== 1 ? "s" : ""}`;
  }

  if (months === 0) {
    return `${years} year${years !== 1 ? "s" : ""}`;
  }

  return `${years}.${Math.round(months / 1.2)} years`;
}

// Format currency for projection displays
export function formatProjectionAmount(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}k`;
  }
  return `$${amount.toFixed(0)}`;
}
