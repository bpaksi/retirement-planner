import { query } from "../_generated/server";

/**
 * Social Security benefit calculation utilities.
 *
 * Key concepts:
 * - FRA (Full Retirement Age): 67 for those born 1960+
 * - Early claiming (62-66): ~6.67% reduction per year before FRA
 * - Delayed claiming (67-70): ~8% increase per year after FRA
 * - COLA: Cost of living adjustments, historically ~2-3%
 */

// Reduction per month for claiming before FRA (first 36 months)
const EARLY_REDUCTION_RATE_FIRST_36 = 5 / 9 / 100; // 0.556% per month
// Reduction per month for claiming more than 36 months before FRA
const EARLY_REDUCTION_RATE_AFTER_36 = 5 / 12 / 100; // 0.417% per month
// Increase per month for claiming after FRA
const DELAYED_INCREASE_RATE = 8 / 12 / 100; // 0.667% per month (8% per year)

/**
 * Calculate benefit at any claiming age based on FRA benefit.
 */
function calculateBenefitAtAge(
  benefitAtFRA: number,
  claimingAge: number,
  fraAge: number = 67
): number {
  const monthsFromFRA = (claimingAge - fraAge) * 12;

  if (monthsFromFRA === 0) {
    return benefitAtFRA;
  }

  if (monthsFromFRA < 0) {
    // Early claiming - reduce benefit
    const monthsEarly = Math.abs(monthsFromFRA);
    let reduction = 0;

    if (monthsEarly <= 36) {
      reduction = monthsEarly * EARLY_REDUCTION_RATE_FIRST_36;
    } else {
      reduction =
        36 * EARLY_REDUCTION_RATE_FIRST_36 +
        (monthsEarly - 36) * EARLY_REDUCTION_RATE_AFTER_36;
    }

    return benefitAtFRA * (1 - reduction);
  } else {
    // Delayed claiming - increase benefit
    const monthsDelayed = Math.min(monthsFromFRA, 36); // Max at age 70
    const increase = monthsDelayed * DELAYED_INCREASE_RATE;
    return benefitAtFRA * (1 + increase);
  }
}

/**
 * Get Social Security info for the user.
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const ss = await ctx.db.query("socialSecurity").first();
    return ss;
  },
});

/**
 * Get Social Security with calculated values for Monte Carlo.
 * Returns annual benefit at planned claiming age with COLA applied.
 */
export const getForProjections = query({
  args: {},
  handler: async (ctx) => {
    const ss = await ctx.db.query("socialSecurity").first();

    if (!ss) {
      return null;
    }

    const claimingAge = ss.plannedClaimingAge ?? 67;
    const monthlyBenefitAtClaiming = calculateBenefitAtAge(
      ss.benefitAt67,
      claimingAge
    );

    // Calculate current age
    const now = new Date();
    const currentAge =
      now.getFullYear() -
      ss.birthYear -
      (now.getMonth() + 1 < ss.birthMonth ? 1 : 0);

    // Calculate years until claiming
    const yearsUntilClaiming = Math.max(0, claimingAge - currentAge);

    // Apply COLA to project future benefit
    const projectedMonthlyBenefit =
      monthlyBenefitAtClaiming * Math.pow(1 + ss.colaRate, yearsUntilClaiming);

    // Calculate spouse benefit if applicable
    let spouseAnnualBenefit = 0;
    if (ss.hasSpouse && ss.spouseBenefitAt67) {
      const spouseClaimingAge = ss.spousePlannedClaimingAge ?? 67;
      const spouseMonthly = calculateBenefitAtAge(
        ss.spouseBenefitAt67,
        spouseClaimingAge
      );
      // Apply COLA (simplified - assumes same years until claiming)
      spouseAnnualBenefit =
        spouseMonthly * 12 * Math.pow(1 + ss.colaRate, yearsUntilClaiming);
    }

    return {
      // Primary earner
      claimingAge,
      monthlyBenefit: Math.round(monthlyBenefitAtClaiming),
      annualBenefit: Math.round(monthlyBenefitAtClaiming * 12),
      projectedMonthlyBenefit: Math.round(projectedMonthlyBenefit),
      projectedAnnualBenefit: Math.round(projectedMonthlyBenefit * 12),

      // Spouse
      hasSpouse: ss.hasSpouse ?? false,
      spouseAnnualBenefit: Math.round(spouseAnnualBenefit),

      // Combined
      combinedAnnualBenefit: Math.round(
        projectedMonthlyBenefit * 12 + spouseAnnualBenefit
      ),

      // Timing
      currentAge,
      yearsUntilClaiming,
      birthYear: ss.birthYear,
      colaRate: ss.colaRate,

      // Benefits at different ages for comparison
      benefitComparison: {
        at62: {
          monthly: Math.round(calculateBenefitAtAge(ss.benefitAt67, 62)),
          annual: Math.round(calculateBenefitAtAge(ss.benefitAt67, 62) * 12),
          percentOfFRA: Math.round(
            (calculateBenefitAtAge(ss.benefitAt67, 62) / ss.benefitAt67) * 100
          ),
        },
        at65: {
          monthly: Math.round(calculateBenefitAtAge(ss.benefitAt67, 65)),
          annual: Math.round(calculateBenefitAtAge(ss.benefitAt67, 65) * 12),
          percentOfFRA: Math.round(
            (calculateBenefitAtAge(ss.benefitAt67, 65) / ss.benefitAt67) * 100
          ),
        },
        at67: {
          monthly: Math.round(ss.benefitAt67),
          annual: Math.round(ss.benefitAt67 * 12),
          percentOfFRA: 100,
        },
        at70: {
          monthly: Math.round(calculateBenefitAtAge(ss.benefitAt67, 70)),
          annual: Math.round(calculateBenefitAtAge(ss.benefitAt67, 70) * 12),
          percentOfFRA: Math.round(
            (calculateBenefitAtAge(ss.benefitAt67, 70) / ss.benefitAt67) * 100
          ),
        },
      },
    };
  },
});
