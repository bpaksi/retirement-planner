"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LabelWithTooltip } from "@/components/ui/LabelWithTooltip";
import { formatCurrency, cn } from "@/lib/utils";
import { PROJECTION_DEFAULTS } from "@/lib/calculations/projections";
import {
  ChevronDown,
  ChevronUp,
  User,
  TrendingUp,
  Shield,
  Settings2,
  Loader2,
  Check,
  RotateCcw,
  Wallet,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";

// Import server actions for data fetching
import {
  fetchRetirementProfile,
  fetchGuardrailsConfig,
  fetchAssumptionsWithDefaults,
  fetchAnnualBudgets,
  fetchSpendingSummary,
} from "@/app/actions/data";

// Import actions
import { upsertRetirementProfile } from "@/app/actions/retirementProfile";
import { upsertGuardrailsConfig } from "@/app/actions/guardrails";
import { upsertMonteCarloAssumptions } from "@/app/actions/monteCarlo";
import {
  createAnnualBudget,
  updateAnnualBudget,
  deleteAnnualBudget,
} from "@/app/actions/annualBudgets";

// Default guardrails values
const GUARDRAILS_DEFAULTS = {
  upperThresholdPercent: 0.2,
  lowerThresholdPercent: 0.2,
  spendingAdjustmentPercent: 0.1,
  strategyType: "percentage" as const,
};

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

function Section({ title, icon, isExpanded, onToggle, children, badge }: SectionProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full p-4 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-medium">{title}</span>
          {badge}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isExpanded && <div className="p-4 border-t border-border">{children}</div>}
    </div>
  );
}

// Types for loaded data
interface LoadedData {
  profile: Awaited<ReturnType<typeof fetchRetirementProfile>>;
  guardrailsConfig: Awaited<ReturnType<typeof fetchGuardrailsConfig>>;
  monteCarloAssumptions: Awaited<ReturnType<typeof fetchAssumptionsWithDefaults>>;
  annualBudgets: Awaited<ReturnType<typeof fetchAnnualBudgets>>;
  spendingBreakdown: {
    baseLivingExpense: number;
    monthlyBaseLivingExpense: number;
    isBaseLivingExpenseAutoCalculated: boolean;
    suggestedBaseLivingExpense: number;
    totalGoalsAmount: number;
    essentialFloor: number;
    discretionaryAmount: number;
    monthsOfTransactionData: number;
    hasEnoughTransactionData: boolean;
  };
}

interface UnifiedSettingsFormProps {
  onSettingsChanged?: () => void;
}

export function UnifiedSettingsForm({ onSettingsChanged }: UnifiedSettingsFormProps) {
  // Section expansion state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["profile", "spending"])
  );

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadedData, setLoadedData] = useState<LoadedData | null>(null);

  // Form state - Profile
  const [retirementDate, setRetirementDate] = useState("");
  const [currentAge, setCurrentAge] = useState("");
  const [annualSpending, setAnnualSpending] = useState("");

  // Form state - Spending Breakdown
  const [monthlyBaseLivingExpense, setMonthlyBaseLivingExpense] = useState("");
  const [useAutoBaseLivingExpense, setUseAutoBaseLivingExpense] = useState(false);
  // New goal form
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalAmount, setNewGoalAmount] = useState("");
  const [newGoalIsEssential, setNewGoalIsEssential] = useState(false);
  const [newGoalStartYear, setNewGoalStartYear] = useState("");
  const [newGoalEndYear, setNewGoalEndYear] = useState("");

  // Form state - Market Assumptions
  const [expectedReturn, setExpectedReturn] = useState("");
  const [optimisticReturn, setOptimisticReturn] = useState("");
  const [pessimisticReturn, setPessimisticReturn] = useState("");
  const [realReturn, setRealReturn] = useState("");
  const [volatility, setVolatility] = useState("");

  // Form state - Guardrails
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(false);
  const [upperThreshold, setUpperThreshold] = useState("");
  const [lowerThreshold, setLowerThreshold] = useState("");
  const [adjustmentPercent, setAdjustmentPercent] = useState("");
  const [strategyType, setStrategyType] = useState<"percentage" | "fixed">("percentage");
  const [fixedAmount, setFixedAmount] = useState("");
  const [spendingFloor, setSpendingFloor] = useState("");
  const [spendingCeiling, setSpendingCeiling] = useState("");

  // Form state - Simulation
  const [planToAge, setPlanToAge] = useState("");
  const [targetSuccessRate, setTargetSuccessRate] = useState("");
  const [iterations, setIterations] = useState("");

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load data on mount
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profile, guardrailsConfig, monteCarloAssumptions, annualBudgets, spendingSummary] =
        await Promise.all([
          fetchRetirementProfile(),
          fetchGuardrailsConfig(),
          fetchAssumptionsWithDefaults(),
          fetchAnnualBudgets(),
          fetchSpendingSummary({ monthsBack: 12 }),
        ]);

      // Calculate spending breakdown from annual budgets and profile
      const baseLivingExpense = profile?.monthlyBaseLivingExpense
        ? profile.monthlyBaseLivingExpense * 12
        : profile?.annualSpending ?? 0;
      const monthlyBase = profile?.monthlyBaseLivingExpense ?? baseLivingExpense / 12;

      const totalGoalsAmount = annualBudgets.reduce((sum, b) => sum + b.annualAmount, 0);
      const essentialGoalsAmount = annualBudgets
        .filter((b) => b.isEssential)
        .reduce((sum, b) => sum + b.annualAmount, 0);

      const spendingBreakdown = {
        baseLivingExpense,
        monthlyBaseLivingExpense: monthlyBase,
        isBaseLivingExpenseAutoCalculated: profile?.isBaseLivingExpenseAutoCalculated ?? false,
        suggestedBaseLivingExpense: spendingSummary.monthlyMedian * 12,
        totalGoalsAmount,
        essentialFloor: baseLivingExpense + essentialGoalsAmount,
        discretionaryAmount: totalGoalsAmount - essentialGoalsAmount,
        monthsOfTransactionData: spendingSummary.dataQuality.monthsWithData,
        hasEnoughTransactionData: spendingSummary.dataQuality.monthsWithData >= 3,
      };

      setLoadedData({
        profile,
        guardrailsConfig,
        monteCarloAssumptions,
        annualBudgets,
        spendingBreakdown,
      });
    } catch (error) {
      console.error("Failed to load settings data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize form state from loaded data
  useEffect(() => {
    if (loadedData?.profile) {
      const profile = loadedData.profile;
      const date = new Date(profile.retirementDate);
      setRetirementDate(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      );
      setCurrentAge(profile.currentAge.toString());
      setAnnualSpending(profile.annualSpending.toString());
    }
  }, [loadedData?.profile]);

  useEffect(() => {
    if (loadedData?.guardrailsConfig) {
      const config = loadedData.guardrailsConfig;
      setGuardrailsEnabled(config.isEnabled);
      setUpperThreshold((config.upperThresholdPercent * 100).toString());
      setLowerThreshold((config.lowerThresholdPercent * 100).toString());
      setAdjustmentPercent((config.spendingAdjustmentPercent * 100).toString());
      setStrategyType(config.strategyType);
      setFixedAmount(config.fixedAdjustmentAmount?.toString() ?? "");
      setSpendingFloor(config.spendingFloor?.toString() ?? "");
      setSpendingCeiling(config.spendingCeiling?.toString() ?? "");
    } else {
      // Use defaults
      setGuardrailsEnabled(false);
      setUpperThreshold((GUARDRAILS_DEFAULTS.upperThresholdPercent * 100).toString());
      setLowerThreshold((GUARDRAILS_DEFAULTS.lowerThresholdPercent * 100).toString());
      setAdjustmentPercent((GUARDRAILS_DEFAULTS.spendingAdjustmentPercent * 100).toString());
      setStrategyType(GUARDRAILS_DEFAULTS.strategyType);
    }
  }, [loadedData?.guardrailsConfig]);

  useEffect(() => {
    if (loadedData?.monteCarloAssumptions) {
      const assumptions = loadedData.monteCarloAssumptions;
      setRealReturn((assumptions.realReturn * 100).toString());
      setVolatility((assumptions.volatility * 100).toString());
      setPlanToAge(assumptions.planToAge.toString());
      setTargetSuccessRate((assumptions.targetSuccessRate * 100).toString());
      setIterations((assumptions.iterations ?? 1000).toString());
    }
    // Initialize standard projection returns from defaults
    setExpectedReturn((PROJECTION_DEFAULTS.expectedReturn * 100).toString());
    setOptimisticReturn((PROJECTION_DEFAULTS.optimisticReturn * 100).toString());
    setPessimisticReturn((PROJECTION_DEFAULTS.pessimisticReturn * 100).toString());
  }, [loadedData?.monteCarloAssumptions]);

  // Initialize base living expense from spending breakdown
  useEffect(() => {
    if (loadedData?.spendingBreakdown) {
      setMonthlyBaseLivingExpense(loadedData.spendingBreakdown.monthlyBaseLivingExpense.toString());
      setUseAutoBaseLivingExpense(loadedData.spendingBreakdown.isBaseLivingExpenseAutoCalculated);
    }
  }, [loadedData?.spendingBreakdown]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Handler for adding a new goal
  const handleAddGoal = async () => {
    if (!newGoalName || !newGoalAmount) return;

    await createAnnualBudget({
      name: newGoalName,
      annualAmount: parseFloat(newGoalAmount),
      isEssential: newGoalIsEssential,
      startYear: newGoalStartYear ? parseInt(newGoalStartYear, 10) : undefined,
      endYear: newGoalEndYear ? parseInt(newGoalEndYear, 10) : undefined,
    });

    // Reset form
    setNewGoalName("");
    setNewGoalAmount("");
    setNewGoalIsEssential(false);
    setNewGoalStartYear("");
    setNewGoalEndYear("");

    // Reload data
    await loadData();
    onSettingsChanged?.();
  };

  // Handler for toggling goal essential status
  const handleToggleEssential = async (id: string, isEssential: boolean) => {
    await updateAnnualBudget({ id, isEssential: !isEssential });
    await loadData();
    onSettingsChanged?.();
  };

  // Handler for deleting a goal
  const handleDeleteGoal = async (id: string) => {
    await deleteAnnualBudget(id);
    await loadData();
    onSettingsChanged?.();
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Save profile with base living expense
      if (retirementDate && currentAge) {
        const [year, month] = retirementDate.split("-").map(Number);
        const retireDate = new Date(year, month - 1, 1).getTime();

        // Calculate annual spending from base + goals
        const suggestedMonthlyBase = loadedData?.spendingBreakdown.suggestedBaseLivingExpense
          ? loadedData.spendingBreakdown.suggestedBaseLivingExpense / 12
          : 0;
        const monthlyBase = useAutoBaseLivingExpense
          ? suggestedMonthlyBase
          : parseFloat(monthlyBaseLivingExpense) || 0;
        const goalsTotal = loadedData?.spendingBreakdown.totalGoalsAmount ?? 0;
        const totalSpending = monthlyBase * 12 + goalsTotal;

        await upsertRetirementProfile({
          retirementDate: retireDate,
          currentAge: parseInt(currentAge, 10),
          annualSpending: totalSpending,
          isSpendingAutoCalculated: false, // Legacy field
          monthlyBaseLivingExpense: monthlyBase,
          isBaseLivingExpenseAutoCalculated: useAutoBaseLivingExpense,
        });
      }

      // Save guardrails
      await upsertGuardrailsConfig({
        isEnabled: guardrailsEnabled,
        upperThresholdPercent: parseFloat(upperThreshold) / 100,
        lowerThresholdPercent: parseFloat(lowerThreshold) / 100,
        spendingAdjustmentPercent: parseFloat(adjustmentPercent) / 100,
        strategyType,
        fixedAdjustmentAmount: fixedAmount ? parseFloat(fixedAmount) : undefined,
        spendingFloor: spendingFloor ? parseFloat(spendingFloor) : undefined,
        spendingCeiling: spendingCeiling ? parseFloat(spendingCeiling) : undefined,
      });

      // Save Monte Carlo assumptions
      await upsertMonteCarloAssumptions({
        realReturn: parseFloat(realReturn) / 100,
        volatility: parseFloat(volatility) / 100,
        planToAge: parseInt(planToAge, 10),
        targetSuccessRate: parseFloat(targetSuccessRate) / 100,
        iterations: parseInt(iterations, 10),
      });

      setHasUnsavedChanges(false);
      await loadData();
      onSettingsChanged?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    // Reset market assumptions
    setExpectedReturn((PROJECTION_DEFAULTS.expectedReturn * 100).toString());
    setOptimisticReturn((PROJECTION_DEFAULTS.optimisticReturn * 100).toString());
    setPessimisticReturn((PROJECTION_DEFAULTS.pessimisticReturn * 100).toString());
    setRealReturn("5");
    setVolatility("12");

    // Reset simulation
    setPlanToAge("95");
    setTargetSuccessRate("90");
    setIterations("1000");

    // Reset guardrails
    setUpperThreshold("20");
    setLowerThreshold("20");
    setAdjustmentPercent("10");
    setStrategyType("percentage");
    setFixedAmount("");
    setSpendingFloor("");
    setSpendingCeiling("");

    setHasUnsavedChanges(true);
  };

  const markChanged = () => setHasUnsavedChanges(true);

  // Loading state
  if (isLoading || !loadedData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentSpending = parseFloat(annualSpending) || 0;
  const spendingBreakdown = loadedData.spendingBreakdown;
  const annualBudgets = loadedData.annualBudgets;

  // Spending breakdown calculations
  const suggestedMonthlyBase = spendingBreakdown.suggestedBaseLivingExpense / 12;
  const currentMonthlyBase = useAutoBaseLivingExpense
    ? suggestedMonthlyBase
    : parseFloat(monthlyBaseLivingExpense) || 0;
  const totalAnnualSpending = currentMonthlyBase * 12 + spendingBreakdown.totalGoalsAmount;
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-4">
      {/* Section A: Profile */}
      <Section
        title="Profile"
        icon={<User className="w-5 h-5 text-primary" />}
        isExpanded={expandedSections.has("profile")}
        onToggle={() => toggleSection("profile")}
        badge={
          loadedData.profile ? (
            <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
              Configured
            </span>
          ) : (
            <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full">
              Setup Required
            </span>
          )
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <LabelWithTooltip
              label="Retirement Date"
              tooltip="When do you plan to retire? This determines when you start drawing down your portfolio."
              htmlFor="retirementDate"
            />
            <Input
              id="retirementDate"
              type="month"
              value={retirementDate}
              onChange={(e) => {
                setRetirementDate(e.target.value);
                markChanged();
              }}
              className="mt-1.5"
            />
          </div>

          <div>
            <LabelWithTooltip
              label="Current Age"
              tooltip="Your current age. Used to calculate years until retirement and planning horizon."
              htmlFor="currentAge"
            />
            <Input
              id="currentAge"
              type="number"
              min={18}
              max={100}
              value={currentAge}
              onChange={(e) => {
                setCurrentAge(e.target.value);
                markChanged();
              }}
              placeholder="e.g., 58"
              className="mt-1.5"
            />
          </div>

        </div>
      </Section>

      {/* Section B: Spending Breakdown */}
      <Section
        title="Spending Breakdown"
        icon={<Wallet className="w-5 h-5 text-emerald-500" />}
        isExpanded={expandedSections.has("spending")}
        onToggle={() => toggleSection("spending")}
        badge={
          <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">
            {formatCurrency(totalAnnualSpending)}/yr
          </span>
        }
      >
        <div className="space-y-6">
          {/* Summary Bar */}
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Base Living</p>
                <p className="text-lg font-semibold">{formatCurrency(currentMonthlyBase * 12)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">+ Goals</p>
                <p className="text-lg font-semibold">{formatCurrency(spendingBreakdown.totalGoalsAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">= Total</p>
                <p className="text-lg font-bold text-emerald-500">{formatCurrency(totalAnnualSpending)}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
              <span className="text-muted-foreground">
                Essential Floor: {formatCurrency(spendingBreakdown.essentialFloor)}
              </span>
              <span className="text-muted-foreground">
                Discretionary: {formatCurrency(spendingBreakdown.discretionaryAmount)}
              </span>
            </div>
          </div>

          {/* Base Living Expenses */}
          <div>
            <LabelWithTooltip
              label="Monthly Base Living Expenses"
              tooltip={
                <div className="space-y-2">
                  <p>Your essential monthly expenses (housing, food, utilities, healthcare).</p>
                  <p>This is the spending floor - guardrails will never reduce your spending below this.</p>
                  {spendingBreakdown.hasEnoughTransactionData && (
                    <p className="text-xs text-muted-foreground">
                      Median of last {spendingBreakdown.monthsOfTransactionData} months of transactions
                    </p>
                  )}
                </div>
              }
              htmlFor="monthlyBaseLivingExpense"
            />
            <div className="space-y-2 mt-1.5">
              <div className="flex items-center gap-2">
                <Input
                  id="monthlyBaseLivingExpense"
                  type="number"
                  min={0}
                  step={100}
                  value={monthlyBaseLivingExpense}
                  onChange={(e) => {
                    setMonthlyBaseLivingExpense(e.target.value);
                    setUseAutoBaseLivingExpense(false);
                    markChanged();
                  }}
                  placeholder="e.g., 5000"
                  disabled={useAutoBaseLivingExpense}
                  className="w-40"
                />
                <span className="text-sm text-muted-foreground">/month</span>
                <span className="text-sm text-muted-foreground ml-2">
                  = {formatCurrency(currentMonthlyBase * 12)}/yr
                </span>
              </div>
              {spendingBreakdown.hasEnoughTransactionData && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAutoBaseLivingExpense}
                    onChange={(e) => {
                      setUseAutoBaseLivingExpense(e.target.checked);
                      if (e.target.checked) {
                        setMonthlyBaseLivingExpense(suggestedMonthlyBase.toFixed(0));
                      }
                      markChanged();
                    }}
                    className="rounded"
                  />
                  Use auto-calculated ({formatCurrency(suggestedMonthlyBase)}/month median)
                </label>
              )}
              {!spendingBreakdown.hasEnoughTransactionData && (
                <p className="text-xs text-yellow-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Import more transactions for auto-calculation (need 3+ months)
                </p>
              )}
            </div>
          </div>

          {/* Spending Goals */}
          <div>
            <h4 className="text-sm font-medium mb-3">Spending Goals (Discretionary)</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Additional spending beyond base living expenses. Mark goals as &quot;essential&quot; if guardrails should never reduce them.
            </p>

            {/* Existing Goals List */}
            {annualBudgets.length > 0 && (
              <div className="space-y-2 mb-4">
                {annualBudgets.map((budget) => (
                  <div
                    key={budget.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      budget.isEssential
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-muted/30 border-border"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{budget.name}</span>
                        {budget.isEssential && (
                          <span className="text-xs bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded">
                            Essential
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(budget.annualAmount)}/yr
                        {(budget.startYear || budget.endYear) && (
                          <span className="ml-2">
                            ({budget.startYear ?? "start"} - {budget.endYear ?? "ongoing"})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleEssential(budget.id, budget.isEssential ?? false)}
                        title={budget.isEssential ? "Mark as discretionary" : "Mark as essential"}
                      >
                        <Shield
                          className={cn(
                            "w-4 h-4",
                            budget.isEssential ? "text-emerald-500" : "text-muted-foreground"
                          )}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGoal(budget.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Goal Form */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h5 className="text-sm font-medium">Add New Goal</h5>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  placeholder="Goal name (e.g., Travel)"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={newGoalAmount}
                    onChange={(e) => setNewGoalAmount(e.target.value)}
                    min={0}
                    step={1000}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">/yr</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Start year"
                    value={newGoalStartYear}
                    onChange={(e) => setNewGoalStartYear(e.target.value)}
                    min={currentYear}
                    max={currentYear + 50}
                    className="w-24"
                  />
                  <span className="text-xs">-</span>
                  <Input
                    type="number"
                    placeholder="End year"
                    value={newGoalEndYear}
                    onChange={(e) => setNewGoalEndYear(e.target.value)}
                    min={currentYear}
                    max={currentYear + 50}
                    className="w-24"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newGoalIsEssential}
                      onChange={(e) => setNewGoalIsEssential(e.target.checked)}
                      className="rounded"
                    />
                    Essential
                  </label>
                  <Button
                    size="sm"
                    onClick={handleAddGoal}
                    disabled={!newGoalName || !newGoalAmount}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave years blank for ongoing goals. Use start/end for time-limited goals like &quot;Travel first 10 years&quot;.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Section C: Market Assumptions */}
      <Section
        title="Market Assumptions"
        icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
        isExpanded={expandedSections.has("market")}
        onToggle={() => toggleSection("market")}
      >
        <div className="space-y-6">
          {/* Monte Carlo Assumptions */}
          <div>
            <h4 className="text-sm font-medium mb-3">Monte Carlo Simulation</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <LabelWithTooltip
                  label="Expected Real Return"
                  tooltip={
                    <div className="space-y-2">
                      <p>Average annual return AFTER inflation.</p>
                      <p>5% real return = 8% nominal if inflation is 3%.</p>
                      <p className="text-xs text-muted-foreground">
                        Historical balanced portfolio (60/40): ~5% real
                      </p>
                    </div>
                  }
                  htmlFor="realReturn"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="realReturn"
                    type="number"
                    min={-5}
                    max={15}
                    step={0.5}
                    value={realReturn}
                    onChange={(e) => {
                      setRealReturn(e.target.value);
                      markChanged();
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>

              <div>
                <LabelWithTooltip
                  label="Volatility"
                  tooltip={
                    <div className="space-y-2">
                      <p>How much returns vary year-to-year (standard deviation).</p>
                      <p>12% is typical for a 60/40 balanced portfolio.</p>
                      <p className="text-xs text-muted-foreground">
                        Higher = more uncertainty in projections
                      </p>
                    </div>
                  }
                  htmlFor="volatility"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="volatility"
                    type="number"
                    min={1}
                    max={40}
                    step={1}
                    value={volatility}
                    onChange={(e) => {
                      setVolatility(e.target.value);
                      markChanged();
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Standard Projection Assumptions */}
          <div>
            <h4 className="text-sm font-medium mb-3">Standard Projection Scenarios</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <LabelWithTooltip
                  label="Expected Return"
                  tooltip="Return used for the 'expected' scenario line in standard projections."
                  htmlFor="expectedReturn"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="expectedReturn"
                    type="number"
                    min={0}
                    max={15}
                    step={0.5}
                    value={expectedReturn}
                    onChange={(e) => {
                      setExpectedReturn(e.target.value);
                      markChanged();
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">% real</span>
                </div>
              </div>

              <div>
                <LabelWithTooltip
                  label="Optimistic Return"
                  tooltip="Return used for the 'optimistic' scenario (best-case) line."
                  htmlFor="optimisticReturn"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="optimisticReturn"
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={optimisticReturn}
                    onChange={(e) => {
                      setOptimisticReturn(e.target.value);
                      markChanged();
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">% real</span>
                </div>
              </div>

              <div>
                <LabelWithTooltip
                  label="Pessimistic Return"
                  tooltip="Return used for the 'pessimistic' scenario (worst-case) line."
                  htmlFor="pessimisticReturn"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="pessimisticReturn"
                    type="number"
                    min={-5}
                    max={10}
                    step={0.5}
                    value={pessimisticReturn}
                    onChange={(e) => {
                      setPessimisticReturn(e.target.value);
                      markChanged();
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">% real</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section D: Guardrails */}
      <Section
        title="Guardrails Strategy"
        icon={
          <Shield
            className={cn(
              "w-5 h-5",
              guardrailsEnabled ? "text-primary" : "text-muted-foreground"
            )}
          />
        }
        isExpanded={expandedSections.has("guardrails")}
        onToggle={() => toggleSection("guardrails")}
        badge={
          guardrailsEnabled ? (
            <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
              Enabled
            </span>
          ) : (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              Disabled
            </span>
          )
        }
      >
        <div className="space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium text-sm">Enable Guardrails</p>
              <p className="text-xs text-muted-foreground">
                Automatically adjust spending based on portfolio performance
              </p>
            </div>
            <button
              onClick={() => {
                setGuardrailsEnabled(!guardrailsEnabled);
                markChanged();
              }}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative",
                guardrailsEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  guardrailsEnabled ? "translate-x-7" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {guardrailsEnabled && (
            <>
              {/* Thresholds */}
              <div>
                <h4 className="text-sm font-medium mb-3">Thresholds</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <LabelWithTooltip
                      label="Upper Threshold"
                      tooltip={
                        <div className="space-y-2">
                          <p>When portfolio exceeds this % above target, increase spending.</p>
                          <p className="text-xs text-muted-foreground">
                            Example: 20% means if portfolio is 20%+ above expected, you can spend more
                          </p>
                        </div>
                      }
                      htmlFor="upperThreshold"
                    />
                    <div className="flex items-center gap-2 mt-1.5">
                      <Input
                        id="upperThreshold"
                        type="number"
                        min={5}
                        max={50}
                        step={5}
                        value={upperThreshold}
                        onChange={(e) => {
                          setUpperThreshold(e.target.value);
                          markChanged();
                        }}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">% above target</span>
                    </div>
                  </div>

                  <div>
                    <LabelWithTooltip
                      label="Lower Threshold"
                      tooltip={
                        <div className="space-y-2">
                          <p>When portfolio falls this % below target, decrease spending.</p>
                          <p className="text-xs text-muted-foreground">
                            Example: 20% means if portfolio is 20%+ below expected, reduce spending
                          </p>
                        </div>
                      }
                      htmlFor="lowerThreshold"
                    />
                    <div className="flex items-center gap-2 mt-1.5">
                      <Input
                        id="lowerThreshold"
                        type="number"
                        min={5}
                        max={50}
                        step={5}
                        value={lowerThreshold}
                        onChange={(e) => {
                          setLowerThreshold(e.target.value);
                          markChanged();
                        }}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">% below target</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Adjustment Settings */}
              <div>
                <h4 className="text-sm font-medium mb-3">Spending Adjustment</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <LabelWithTooltip
                      label="Adjustment Type"
                      tooltip="Choose whether spending adjusts by a percentage or fixed dollar amount."
                      htmlFor="strategyType"
                    />
                    <Select
                      id="strategyType"
                      value={strategyType}
                      onChange={(e) => {
                        setStrategyType(e.target.value as "percentage" | "fixed");
                        markChanged();
                      }}
                      className="mt-1.5"
                    >
                      <option value="percentage">Percentage of spending</option>
                      <option value="fixed">Fixed dollar amount</option>
                    </Select>
                  </div>

                  <div>
                    {strategyType === "percentage" ? (
                      <>
                        <LabelWithTooltip
                          label="Adjustment Percent"
                          tooltip="How much to increase/decrease spending when thresholds are hit."
                          htmlFor="adjustmentPercent"
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                          <Input
                            id="adjustmentPercent"
                            type="number"
                            min={1}
                            max={25}
                            step={1}
                            value={adjustmentPercent}
                            onChange={(e) => {
                              setAdjustmentPercent(e.target.value);
                              markChanged();
                            }}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">
                            = {formatCurrency(currentSpending * parseFloat(adjustmentPercent || "0") / 100)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <LabelWithTooltip
                          label="Fixed Amount"
                          tooltip="Fixed dollar amount to adjust spending by."
                          htmlFor="fixedAmount"
                        />
                        <Input
                          id="fixedAmount"
                          type="number"
                          min={0}
                          step={1000}
                          value={fixedAmount}
                          onChange={(e) => {
                            setFixedAmount(e.target.value);
                            markChanged();
                          }}
                          placeholder="e.g., 5000"
                          className="mt-1.5"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Floor and Ceiling */}
              <div>
                <h4 className="text-sm font-medium mb-3">Spending Limits</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <LabelWithTooltip
                      label="Spending Floor"
                      tooltip={
                        <div className="space-y-2">
                          <p>Minimum annual spending (essentials).</p>
                          <p>Guardrails never reduce spending below this amount.</p>
                          <p className="text-xs text-muted-foreground">
                            Tip: Calculate your essential expenses (housing, food, healthcare)
                          </p>
                        </div>
                      }
                      htmlFor="spendingFloor"
                    />
                    <Input
                      id="spendingFloor"
                      type="number"
                      min={0}
                      step={1000}
                      value={spendingFloor}
                      onChange={(e) => {
                        setSpendingFloor(e.target.value);
                        markChanged();
                      }}
                      placeholder="Minimum annual spending"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <LabelWithTooltip
                      label="Spending Ceiling"
                      tooltip="Maximum annual spending. Guardrails never increase spending above this amount."
                      htmlFor="spendingCeiling"
                    />
                    <Input
                      id="spendingCeiling"
                      type="number"
                      min={0}
                      step={1000}
                      value={spendingCeiling}
                      onChange={(e) => {
                        setSpendingCeiling(e.target.value);
                        markChanged();
                      }}
                      placeholder="Maximum annual spending"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Section E: Simulation */}
      <Section
        title="Simulation Settings"
        icon={<Settings2 className="w-5 h-5 text-purple-500" />}
        isExpanded={expandedSections.has("simulation")}
        onToggle={() => toggleSection("simulation")}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <LabelWithTooltip
              label="Plan to Age"
              tooltip={
                <div className="space-y-2">
                  <p>How long should your money last?</p>
                  <p>95 is conservative--about 25% of 65-year-olds live past 90.</p>
                  <p className="text-xs text-muted-foreground">
                    Higher = safer but requires more savings
                  </p>
                </div>
              }
              htmlFor="planToAge"
            />
            <Input
              id="planToAge"
              type="number"
              min={70}
              max={120}
              value={planToAge}
              onChange={(e) => {
                setPlanToAge(e.target.value);
                markChanged();
              }}
              className="mt-1.5"
            />
          </div>

          <div>
            <LabelWithTooltip
              label="Target Success Rate"
              tooltip={
                <div className="space-y-2">
                  <p>What probability of success do you want?</p>
                  <p>90% is the industry standard for retirement planning.</p>
                  <p className="text-xs text-muted-foreground">
                    Higher target = more conservative spending
                  </p>
                </div>
              }
              htmlFor="targetSuccessRate"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <Input
                id="targetSuccessRate"
                type="number"
                min={50}
                max={99}
                step={5}
                value={targetSuccessRate}
                onChange={(e) => {
                  setTargetSuccessRate(e.target.value);
                  markChanged();
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          <div>
            <LabelWithTooltip
              label="Iterations"
              tooltip="Number of random market scenarios to simulate. More iterations = more accurate but slower."
              htmlFor="iterations"
            />
            <Select
              id="iterations"
              value={iterations}
              onChange={(e) => {
                setIterations(e.target.value);
                markChanged();
              }}
              className="mt-1.5"
            >
              <option value="500">500 (faster)</option>
              <option value="1000">1,000 (recommended)</option>
              <option value="5000">5,000 (more accurate)</option>
              <option value="10000">10,000 (most accurate)</option>
            </Select>
          </div>
        </div>
      </Section>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={handleResetToDefaults} disabled={isSaving}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button onClick={handleSaveAll} disabled={isSaving || !hasUnsavedChanges}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {hasUnsavedChanges && (
        <p className="text-xs text-yellow-500 text-center">
          You have unsaved changes
        </p>
      )}
    </div>
  );
}
