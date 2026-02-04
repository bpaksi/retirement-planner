"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Sidebar } from "@/components/layout/Sidebar";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
  DialogCloseButton,
} from "@/components/ui/Dialog";
import {
  Home,
  Car,
  GraduationCap,
  CreditCard,
  Wallet,
  Calendar,
  TrendingDown,
  Calculator,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  Check,
  ArrowRight,
  X,
  Plus,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LIABILITY_ICONS = {
  mortgage: Home,
  auto_loan: Car,
  student_loan: GraduationCap,
  personal_loan: Wallet,
  credit_card: CreditCard,
  other: Wallet,
} as const;

const LIABILITY_LABELS = {
  mortgage: "Mortgage",
  auto_loan: "Auto Loan",
  student_loan: "Student Loan",
  personal_loan: "Personal Loan",
  credit_card: "Credit Card",
  other: "Other",
} as const;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatDateFull(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export default function LiabilityDetailPage() {
  const params = useParams();
  const liabilityId = params.id as Id<"liabilities">;

  const [showSchedule, setShowSchedule] = useState(false);
  const [showCalculator, setShowCalculator] = useState(true);
  const [extraMonthly, setExtraMonthly] = useState("");
  const [oneTimePayment, setOneTimePayment] = useState("");
  const [oneTimePaymentDate, setOneTimePaymentDate] = useState(getTodayDateString());
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPastPayments, setShowPastPayments] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    originalAmount: "",
    currentBalance: "",
    interestRate: "",
    termYears: "",
    startDate: "",
  });

  const liability = useQuery(api.liabilities.queries.get, { id: liabilityId });

  // Payment schedule uses only saved values from DB
  const paymentSchedule = useQuery(
    api.liabilities.queries.getPaymentSchedule,
    { id: liabilityId }
  );

  // Forecast uses saved values only (for current applied state)
  const forecast = useQuery(
    api.liabilities.queries.forecastPayoff,
    { id: liabilityId }
  );

  const calculatedBalance = useQuery(
    api.liabilities.queries.getCalculatedBalance,
    { id: liabilityId }
  );

  const updateLiability = useMutation(api.liabilities.mutations.update);
  const syncBalance = useMutation(api.liabilities.mutations.syncBalanceFromTransactions);
  const addScheduledPayment = useMutation(api.liabilities.mutations.addScheduledPayment);
  const removeScheduledPayment = useMutation(api.liabilities.mutations.removeScheduledPayment);
  const clearScheduledPayments = useMutation(api.liabilities.mutations.clearScheduledPayments);

  const handleSaveExtraPayment = async () => {
    if (!extraMonthly) return;
    await updateLiability({
      id: liabilityId,
      extraPaymentMonthly: parseFloat(extraMonthly),
    });
    setExtraMonthly(""); // Clear input after applying
  };

  const handleClearExtraMonthly = async () => {
    await updateLiability({
      id: liabilityId,
      extraPaymentMonthly: 0,
    });
  };

  const handleApplyOneTimePayment = async () => {
    if (!oneTimePayment || !oneTimePaymentDate) return;
    const amount = parseFloat(oneTimePayment);
    const date = new Date(oneTimePaymentDate + "T12:00:00").getTime(); // Use noon to avoid timezone issues
    await addScheduledPayment({
      id: liabilityId,
      amount,
      date,
      description: "One-time payment",
    });
    setOneTimePayment(""); // Clear amount after applying
    setOneTimePaymentDate(getTodayDateString()); // Reset date to today
  };

  const handleRemoveScheduledPayment = async (index: number) => {
    await removeScheduledPayment({
      id: liabilityId,
      index,
    });
  };

  const handleClearScheduledPayments = async () => {
    await clearScheduledPayments({ id: liabilityId });
  };

  const handleSyncBalance = async () => {
    setIsSyncing(true);
    try {
      await syncBalance({ id: liabilityId });
      setShowSyncConfirm(false);
    } catch (error) {
      console.error("Failed to sync balance:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenEditDialog = () => {
    if (!liability) return;
    setEditForm({
      name: liability.name,
      originalAmount: liability.originalAmount?.toString() ?? "",
      currentBalance: liability.currentBalance.toString(),
      interestRate: ((liability.interestRate ?? 0) * 100).toString(),
      termYears: liability.termMonths ? (liability.termMonths / 12).toString() : "",
      startDate: liability.startDate
        ? new Date(liability.startDate).toISOString().split("T")[0]
        : "",
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name) return;

    setIsEditing(true);
    try {
      const updates: {
        id: Id<"liabilities">;
        name?: string;
        originalAmount?: number;
        currentBalance?: number;
        interestRate?: number;
        termMonths?: number;
        startDate?: number;
        minimumPayment?: number;
      } = { id: liabilityId };

      if (editForm.name !== liability?.name) {
        updates.name = editForm.name;
      }
      if (editForm.originalAmount) {
        updates.originalAmount = parseFloat(editForm.originalAmount);
      }
      if (editForm.currentBalance) {
        updates.currentBalance = parseFloat(editForm.currentBalance);
      }
      if (editForm.interestRate) {
        updates.interestRate = parseFloat(editForm.interestRate) / 100;
      }
      if (editForm.termYears) {
        updates.termMonths = parseInt(editForm.termYears) * 12;
      }
      if (editForm.startDate) {
        updates.startDate = new Date(editForm.startDate + "T12:00:00").getTime();
      }

      // Recalculate minimum payment if relevant fields changed
      const originalAmount = updates.originalAmount ?? liability?.originalAmount;
      const interestRate = updates.interestRate ?? liability?.interestRate;
      const termMonths = updates.termMonths ?? liability?.termMonths;

      if (originalAmount && interestRate && interestRate > 0 && termMonths) {
        const monthlyRate = interestRate / 12;
        const n = termMonths;
        const p = originalAmount;
        // Standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
        const payment =
          (p * (monthlyRate * Math.pow(1 + monthlyRate, n))) /
          (Math.pow(1 + monthlyRate, n) - 1);
        updates.minimumPayment = Math.round(payment * 100) / 100;
      }

      await updateLiability(updates);
      setShowEditDialog(false);
    } catch (error) {
      console.error("Failed to update liability:", error);
    } finally {
      setIsEditing(false);
    }
  };

  if (!liability) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  const Icon = LIABILITY_ICONS[liability.type] ?? Wallet;
  const hasAmortizationData =
    liability.originalAmount &&
    liability.termMonths &&
    liability.interestRate &&
    liability.startDate;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Breadcrumb */}
          <Breadcrumb
            items={[
              { label: "Liabilities", href: "/liabilities" },
              { label: liability.name },
            ]}
            className="mb-6"
          />

          {/* Header */}
          <div className="flex items-start gap-4 mb-8">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Icon className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{liability.name}</h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenEditDialog}
                  className="h-8 w-8 p-0"
                  title="Edit loan details"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-muted-foreground">
                {LIABILITY_LABELS[liability.type]}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(liability.currentBalance)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-sm text-muted-foreground">Monthly Payment</p>
                    <p className="text-xl font-bold">
                      {formatCurrencyPrecise(liability.minimumPayment)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-sm text-muted-foreground">Interest Rate</p>
                    <p className="text-xl font-bold">
                      {(liability.interestRate * 100).toFixed(3)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-sm text-muted-foreground">Original Amount</p>
                    <p className="text-xl font-bold">
                      {liability.originalAmount
                        ? formatCurrency(liability.originalAmount)
                        : "—"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-sm text-muted-foreground">Payoff Date</p>
                    <p className="text-xl font-bold text-primary">
                      {forecast && !("error" in forecast) && forecast.baseline?.payoffDate
                        ? formatDate(forecast.baseline.payoffDate)
                        : "—"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Loan Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Loan Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Term</span>
                    <span>
                      {liability.termMonths
                        ? `${liability.termMonths} months (${(liability.termMonths / 12).toFixed(1)} years)`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start Date</span>
                    <span>
                      {liability.startDate
                        ? formatDateFull(liability.startDate)
                        : "—"}
                    </span>
                  </div>
                  {liability.extraPaymentMonthly && liability.extraPaymentMonthly > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Extra Payment</span>
                      <span className="text-success">
                        +{formatCurrencyPrecise(liability.extraPaymentMonthly)}/mo
                      </span>
                    </div>
                  )}
                  {hasAmortizationData && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Equity</span>
                      <span>
                        {Math.round(
                          ((liability.originalAmount! - liability.currentBalance) /
                            liability.originalAmount!) *
                            100
                        )}%
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Calculate from Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-primary" />
                    Calculate from Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {calculatedBalance && "error" in calculatedBalance ? (
                    <div className="text-sm text-muted-foreground">
                      {calculatedBalance.error === "no_linked_account" && (
                        <p>Link an account to enable transaction-based balance calculation.</p>
                      )}
                      {calculatedBalance.error === "no_original_amount" && (
                        <div>
                          <p>Original loan amount is required.</p>
                          <p className="mt-1">
                            Import a &quot;Loan Funding&quot; transaction or set the original amount manually.
                          </p>
                        </div>
                      )}
                      {calculatedBalance.error === "no_transactions" && (
                        <div>
                          <p>No transactions found for this account.</p>
                          <p className="mt-1">Import transactions to calculate balance from payment history.</p>
                        </div>
                      )}
                    </div>
                  ) : calculatedBalance ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="bg-muted rounded-lg p-3">
                          <p className="text-muted-foreground text-xs">Current Balance</p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(calculatedBalance.currentBalance)}
                          </p>
                        </div>
                        <div className="flex items-center justify-center">
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className={cn(
                          "rounded-lg p-3",
                          calculatedBalance.difference !== 0
                            ? "bg-warning/10 border border-warning/20"
                            : "bg-success/10 border border-success/20"
                        )}>
                          <p className="text-muted-foreground text-xs">Calculated</p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(calculatedBalance.calculatedBalance)}
                          </p>
                        </div>
                      </div>

                      {calculatedBalance.difference !== 0 && (
                        <div className="bg-muted/50 rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Difference</span>
                            <span className={cn(
                              "font-medium",
                              calculatedBalance.difference > 0 ? "text-destructive" : "text-success"
                            )}>
                              {calculatedBalance.difference > 0 ? "+" : ""}
                              {formatCurrency(calculatedBalance.difference)}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          Original amount: {formatCurrency(calculatedBalance.originalAmount)}
                        </p>
                        <p>
                          {calculatedBalance.paymentCount} payment{calculatedBalance.paymentCount !== 1 ? "s" : ""} totaling {formatCurrency(calculatedBalance.totalPayments)}
                          {calculatedBalance.dateRange && (
                            <> ({formatDateFull(calculatedBalance.dateRange.start)} – {formatDateFull(calculatedBalance.dateRange.end)})</>
                          )}
                        </p>
                        {calculatedBalance.totalInterest > 0 && (
                          <p className="text-xs">
                            Principal paid: {formatCurrency(calculatedBalance.totalPrincipal)} · Interest paid: {formatCurrency(calculatedBalance.totalInterest)}
                          </p>
                        )}
                      </div>

                      {calculatedBalance.warnings && calculatedBalance.warnings.length > 0 && (
                        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              {calculatedBalance.warnings.map((warning, i) => (
                                <p key={i}>{warning}</p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <Button
                        className="w-full"
                        variant={calculatedBalance.difference === 0 ? "outline" : "default"}
                        disabled={calculatedBalance.difference === 0}
                        onClick={() => setShowSyncConfirm(true)}
                      >
                        {calculatedBalance.difference === 0 ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Balance is up to date
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Apply Calculated Balance
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Loading transaction data...
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Payoff Calculator - Full Width, Collapsible */}
          <Card className="mt-6">
            <CardHeader className="pb-0">
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setShowCalculator(!showCalculator)}
              >
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Payoff Calculator</CardTitle>
                </div>
                {showCalculator ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
            </CardHeader>
            {!showCalculator && (
              <CardContent className="pt-2 pb-4">
                <p className="text-sm text-muted-foreground">
                  {liability.extraPaymentMonthly && liability.extraPaymentMonthly > 0
                    ? `+${formatCurrencyPrecise(liability.extraPaymentMonthly)}/mo extra`
                    : "No extra monthly payment"}
                  {liability.scheduledPayments && liability.scheduledPayments.length > 0 && (
                    <> · {liability.scheduledPayments.length} scheduled payment{liability.scheduledPayments.length !== 1 ? "s" : ""}</>
                  )}
                </p>
              </CardContent>
            )}
            {showCalculator && (
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6">
                  {/* Left Column: Extra Monthly Payment */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Extra Monthly Payment
                    </h3>
                    <div>
                      <Input
                        type="number"
                        value={extraMonthly}
                        onChange={(e) => setExtraMonthly(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Adds to each monthly payment
                      </p>
                      <div className="flex justify-end gap-2 mt-2">
                        {liability.extraPaymentMonthly && liability.extraPaymentMonthly > 0 && (
                          <Button
                            onClick={handleClearExtraMonthly}
                            variant="outline"
                            size="sm"
                          >
                            Clear
                          </Button>
                        )}
                        <Button
                          onClick={handleSaveExtraPayment}
                          disabled={!extraMonthly || parseFloat(extraMonthly) <= 0}
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Apply
                        </Button>
                      </div>
                    </div>
                    {liability.extraPaymentMonthly && liability.extraPaymentMonthly > 0 && (
                      <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Currently:</span>{" "}
                          <span className="font-medium text-success">
                            +{formatCurrencyPrecise(liability.extraPaymentMonthly)}/mo
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Vertical Divider */}
                  <div className="hidden md:block w-px bg-border" />

                  {/* Right Column: One-Time Payments */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      One-Time Payments
                    </h3>
                    <div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={oneTimePayment}
                          onChange={(e) => setOneTimePayment(e.target.value)}
                          placeholder="Amount"
                          min="0"
                          step="0.01"
                          className="flex-1"
                        />
                        <Input
                          type="date"
                          value={oneTimePaymentDate}
                          onChange={(e) => setOneTimePaymentDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="w-36"
                        />
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                        {liability.scheduledPayments && liability.scheduledPayments.length > 0 && (
                          <Button
                            onClick={handleClearScheduledPayments}
                            variant="outline"
                            size="sm"
                          >
                            Clear
                          </Button>
                        )}
                        <Button
                          onClick={handleApplyOneTimePayment}
                          disabled={!oneTimePayment || parseFloat(oneTimePayment) <= 0}
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Apply
                        </Button>
                      </div>
                    </div>

                    {/* Applied scheduled payments list */}
                    {liability.scheduledPayments && liability.scheduledPayments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Applied:</p>
                        {liability.scheduledPayments.map((payment, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm"
                          >
                            <span>
                              {formatCurrency(payment.amount)} on {formatDateFull(payment.date)}
                            </span>
                            <button
                              onClick={() => handleRemoveScheduledPayment(index)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="Remove payment"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Savings Summary: Shows current applied savings */}
                {forecast && !("error" in forecast) && (
                  (liability.extraPaymentMonthly && liability.extraPaymentMonthly > 0) ||
                  (liability.scheduledPayments && liability.scheduledPayments.length > 0)
                ) && (forecast.savings.monthsSaved > 0 || forecast.savings.interestSaved > 0) && (
                  <div className="mt-6 bg-success/10 border border-success/20 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">
                      Current Savings
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Payoff Date</p>
                        <p className="text-lg font-bold text-success">
                          {formatDate(forecast.forecast.payoffDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Time Saved</p>
                        <p className="text-lg font-bold text-success">
                          {forecast.savings.monthsSaved} months
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Interest Saved</p>
                        <p className="text-lg font-bold text-success">
                          {formatCurrency(forecast.savings.interestSaved)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Default message when no extra payments */}
                {(!liability.extraPaymentMonthly || liability.extraPaymentMonthly === 0) &&
                 (!liability.scheduledPayments || liability.scheduledPayments.length === 0) &&
                 forecast && !("error" in forecast) && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Without extra payments, you&apos;ll pay{" "}
                    <span className="font-medium">
                      {formatCurrency(forecast.baseline.totalInterest)}
                    </span>{" "}
                    in interest over{" "}
                    <span className="font-medium">
                      {forecast.baseline.totalPayments} months
                    </span>.
                  </p>
                )}
              </CardContent>
            )}
          </Card>

          {/* Payment Schedule - Full Width */}
          {paymentSchedule && !("error" in paymentSchedule) && (
            <Card className="mt-6">
              <CardHeader className="pb-0">
                <button
                  className="w-full flex items-center justify-between"
                  onClick={() => setShowSchedule(!showSchedule)}
                >
                  <CardTitle className="text-base">Payment Schedule</CardTitle>
                  {showSchedule ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
              </CardHeader>
              {!showSchedule && (
                <CardContent className="pt-2 pb-4">
                  <p className="text-sm text-muted-foreground">
                    {paymentSchedule.actualPayments.length} past payment{paymentSchedule.actualPayments.length !== 1 ? "s" : ""} · {paymentSchedule.remainingPayments} remaining
                  </p>
                </CardContent>
              )}
              {showSchedule && (
                <CardContent className="pt-4">
                  {/* Filter toggle and Summary */}
                  <div className="flex items-center justify-between mb-4">
                    {paymentSchedule.actualPayments.length > 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg text-sm flex-1 mr-4">
                        <div className="grid grid-cols-3 gap-4 max-w-md">
                          <div>
                            <p className="text-muted-foreground text-xs">Total Paid</p>
                            <p className="font-medium">{formatCurrency(paymentSchedule.totalActualPayments)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Principal Paid</p>
                            <p className="font-medium text-success">{formatCurrency(paymentSchedule.totalActualPrincipal)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Interest Paid</p>
                            <p className="font-medium text-destructive">{formatCurrency(paymentSchedule.totalActualInterest)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={showPastPayments}
                        onChange={(e) => setShowPastPayments(e.target.checked)}
                        className="rounded border-border"
                      />
                      Show past payments
                    </label>
                  </div>


                  <div className="max-h-[600px] overflow-y-auto border border-border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-medium">Date</th>
                          <th className="text-left p-3 font-medium">Description</th>
                          <th className="text-right p-3 font-medium">Payment</th>
                          <th className="text-right p-3 font-medium">Principal</th>
                          <th className="text-right p-3 font-medium">Interest</th>
                          <th className="text-right p-3 font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Actual past payments */}
                        {showPastPayments && paymentSchedule.actualPayments.map((row, idx) => (
                          <tr
                            key={`actual-${idx}`}
                            className="border-t border-border bg-background"
                          >
                            <td className="p-3">{formatDateFull(row.date)}</td>
                            <td className="p-3 text-muted-foreground" title={row.description}>
                              {row.description}
                            </td>
                            <td className="p-3 text-right">
                              {formatCurrencyPrecise(row.payment)}
                            </td>
                            <td className="p-3 text-right text-success">
                              {formatCurrencyPrecise(row.principal)}
                            </td>
                            <td className="p-3 text-right text-destructive">
                              {formatCurrencyPrecise(row.interest)}
                            </td>
                            <td className="p-3 text-right font-medium">
                              {formatCurrencyPrecise(row.balance)}
                            </td>
                          </tr>
                        ))}

                        {/* Divider or hidden payments indicator */}
                        {paymentSchedule.actualPayments.length > 0 && paymentSchedule.projectedPayments.length > 0 && (
                          <tr className="border-t-2 border-primary/30">
                            <td colSpan={6} className="p-2 text-center text-xs text-muted-foreground bg-primary/5">
                              {!showPastPayments && (
                                <span className="mr-2">
                                  {paymentSchedule.actualPayments.length} past payment{paymentSchedule.actualPayments.length !== 1 ? "s" : ""} hidden ·
                                </span>
                              )}
                              Projected Future Payments
                              {liability.scheduledPayments && liability.scheduledPayments.length > 0 && (
                                <span className="ml-2 text-primary font-medium">
                                  (includes scheduled payments)
                                </span>
                              )}
                            </td>
                          </tr>
                        )}

                        {/* Projected future payments */}
                        {paymentSchedule.projectedPayments.map((row, idx) => (
                          <tr
                            key={`projected-${row.paymentNumber}-${idx}`}
                            className={cn(
                              "border-t border-border",
                              row.isSimulated
                                ? "bg-primary/10 border-l-2 border-l-primary"
                                : "bg-muted/30",
                              row.balance === 0 && "bg-success/10"
                            )}
                          >
                            <td className={cn(
                              "p-3",
                              row.isSimulated ? "text-primary" : "text-muted-foreground"
                            )}>
                              {formatDateFull(row.date)}
                            </td>
                            <td className={cn(
                              "p-3 italic",
                              row.isSimulated ? "text-primary" : "text-muted-foreground"
                            )}>
                              {row.description ?? (row.paymentNumber === 0
                                ? "One-time payment"
                                : `Payment #${row.paymentNumber}`)}
                            </td>
                            <td className={cn(
                              "p-3 text-right",
                              row.isSimulated ? "text-primary font-medium" : "text-muted-foreground"
                            )}>
                              {formatCurrencyPrecise(row.payment)}
                            </td>
                            <td className={cn(
                              "p-3 text-right",
                              row.isSimulated ? "text-success" : "text-success/70"
                            )}>
                              {formatCurrencyPrecise(row.principal)}
                            </td>
                            <td className={cn(
                              "p-3 text-right",
                              row.isSimulated ? "text-destructive" : "text-destructive/70"
                            )}>
                              {formatCurrencyPrecise(row.interest)}
                            </td>
                            <td className={cn(
                              "p-3 text-right font-medium",
                              row.isSimulated ? "text-primary" : "text-muted-foreground"
                            )}>
                              {formatCurrencyPrecise(row.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {paymentSchedule.projectedPayoffDate && (
                    <p className="mt-3 text-sm text-muted-foreground text-center">
                      Projected payoff: <span className="font-medium text-primary">{formatDate(paymentSchedule.projectedPayoffDate)}</span>
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      </main>

      {/* Balance Sync Confirmation Dialog */}
      <Dialog
        open={showSyncConfirm}
        onClose={() => setShowSyncConfirm(false)}
      >
        <DialogCloseButton onClose={() => setShowSyncConfirm(false)} />
        <DialogHeader>
          <DialogTitle>Update Balance from Transactions</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {calculatedBalance && !("error" in calculatedBalance) && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will update the current balance based on your imported transaction history.
              </p>

              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current balance</span>
                  <span className="font-medium">{formatCurrency(calculatedBalance.currentBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Calculated balance</span>
                  <span className="font-medium">{formatCurrency(calculatedBalance.calculatedBalance)}</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">Adjustment</span>
                  <span className={cn(
                    "font-medium",
                    calculatedBalance.difference > 0 ? "text-destructive" : "text-success"
                  )}>
                    {calculatedBalance.difference > 0 ? "+" : ""}
                    {formatCurrency(calculatedBalance.difference)}
                  </span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>
                  Based on {calculatedBalance.paymentCount} payment{calculatedBalance.paymentCount !== 1 ? "s" : ""}
                  {calculatedBalance.dateRange && (
                    <> ({formatDateFull(calculatedBalance.dateRange.start)} – {formatDateFull(calculatedBalance.dateRange.end)})</>
                  )}
                </p>
              </div>

              {calculatedBalance.warnings && calculatedBalance.warnings.length > 0 && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      {calculatedBalance.warnings.map((warning, i) => (
                        <p key={i}>{warning}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowSyncConfirm(false)}
            disabled={isSyncing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSyncBalance}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Apply Balance
              </>
            )}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Edit Loan Details Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
      >
        <DialogCloseButton onClose={() => setShowEditDialog(false)} />
        <DialogHeader>
          <DialogTitle>Edit Loan Details</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                type="text"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="Loan name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Original Amount
                </label>
                <Input
                  type="number"
                  value={editForm.originalAmount}
                  onChange={(e) =>
                    setEditForm({ ...editForm, originalAmount: e.target.value })
                  }
                  placeholder="250000"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Current Balance
                </label>
                <Input
                  type="number"
                  value={editForm.currentBalance}
                  onChange={(e) =>
                    setEditForm({ ...editForm, currentBalance: e.target.value })
                  }
                  placeholder="200000"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Interest Rate (%)
                </label>
                <Input
                  type="number"
                  value={editForm.interestRate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, interestRate: e.target.value })
                  }
                  placeholder="6.5"
                  min="0"
                  max="100"
                  step="0.001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Term (Years)
                </label>
                <Input
                  type="number"
                  value={editForm.termYears}
                  onChange={(e) =>
                    setEditForm({ ...editForm, termYears: e.target.value })
                  }
                  placeholder="30"
                  min="1"
                  max="50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Loan Start Date
              </label>
              <Input
                type="date"
                value={editForm.startDate}
                onChange={(e) =>
                  setEditForm({ ...editForm, startDate: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                When the loan was originated
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isEditing || !editForm.name}>
                {isEditing ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
