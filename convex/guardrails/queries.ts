import { query } from "../_generated/server";

// Default guardrails configuration
export const GUARDRAILS_DEFAULTS = {
  upperThresholdPercent: 0.20, // 20% above target
  lowerThresholdPercent: 0.20, // 20% below target
  spendingAdjustmentPercent: 0.10, // 10% adjustment
  strategyType: "percentage" as const,
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    // There should only be one guardrails config (single user app)
    const config = await ctx.db.query("guardrailsConfig").first();
    return config;
  },
});

// Get config with defaults filled in
export const getWithDefaults = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("guardrailsConfig").first();

    if (!config) {
      return {
        isEnabled: false,
        upperThresholdPercent: GUARDRAILS_DEFAULTS.upperThresholdPercent,
        lowerThresholdPercent: GUARDRAILS_DEFAULTS.lowerThresholdPercent,
        spendingAdjustmentPercent: GUARDRAILS_DEFAULTS.spendingAdjustmentPercent,
        strategyType: GUARDRAILS_DEFAULTS.strategyType,
        spendingFloor: undefined,
        spendingCeiling: undefined,
        fixedAdjustmentAmount: undefined,
      };
    }

    return config;
  },
});
