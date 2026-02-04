"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Card,
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
  AlertCircle,
  Plus,
  ChevronRight,
} from "lucide-react";

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

type LoanFormData = {
  originalAmount: string;
  currentBalance: string;
  interestRate: string;
  termYears: string;
  startDate: string;
};

const initialFormData: LoanFormData = {
  originalAmount: "",
  currentBalance: "",
  interestRate: "",
  termYears: "",
  startDate: "",
};

export default function LiabilitiesPage() {
  const [setupAccount, setSetupAccount] = useState<{
    id: Id<"accounts">;
    name: string;
    type: string;
  } | null>(null);
  const [formData, setFormData] = useState<LoanFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const liabilities = useQuery(api.liabilities.queries.list, {});
  const unlinkedLoanAccounts = useQuery(api.liabilities.queries.getUnlinkedLoanAccounts, {});

  const createLiability = useMutation(api.liabilities.mutations.create);

  const totalDebt = liabilities?.reduce((sum, l) => sum + l.currentBalance, 0) ?? 0;

  const handleSetupLiability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupAccount || !formData.originalAmount || !formData.interestRate || !formData.termYears) return;

    setIsSubmitting(true);
    try {
      const originalAmount = parseFloat(formData.originalAmount);
      const currentBalance = formData.currentBalance
        ? parseFloat(formData.currentBalance)
        : originalAmount;
      const interestRate = parseFloat(formData.interestRate) / 100;
      const termMonths = parseInt(formData.termYears) * 12;
      const startDate = formData.startDate
        ? new Date(formData.startDate).getTime()
        : Date.now();

      await createLiability({
        type: setupAccount.type === "mortgage" ? "mortgage" : "personal_loan",
        name: setupAccount.name,
        originalAmount,
        currentBalance,
        interestRate,
        termMonths,
        startDate,
        linkedAccountId: setupAccount.id,
      });

      setSetupAccount(null);
      setFormData(initialFormData);
    } catch (error) {
      console.error("Failed to create liability:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Liabilities</h1>
              <p className="text-muted-foreground mt-1">
                Track loans and calculate payoff dates
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Debt</p>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(totalDebt)}
              </p>
            </div>
          </div>

          {/* Liabilities Grid */}
          {liabilities && liabilities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liabilities.map((liability) => {
                const Icon = LIABILITY_ICONS[liability.type] ?? Wallet;
                const hasAmortizationData =
                  liability.originalAmount &&
                  liability.termMonths &&
                  liability.interestRate &&
                  liability.startDate;

                // Calculate payoff date
                let payoffDate: number | null = null;
                if (hasAmortizationData) {
                  const monthlyRate = liability.interestRate / 12;
                  const balance = liability.currentBalance;
                  const payment = liability.minimumPayment + (liability.extraPaymentMonthly ?? 0);

                  // Simple estimation
                  let tempBalance = balance;
                  let months = 0;
                  while (tempBalance > 0.01 && months < 600) {
                    months++;
                    const interest = tempBalance * monthlyRate;
                    tempBalance -= (payment - interest);
                  }
                  const date = new Date();
                  date.setMonth(date.getMonth() + months);
                  payoffDate = date.getTime();
                }

                const progress = hasAmortizationData
                  ? ((liability.originalAmount! - liability.currentBalance) /
                      liability.originalAmount!) *
                    100
                  : 0;

                return (
                  <Link key={liability._id} href={`/liabilities/${liability._id}`}>
                    <Card className="cursor-pointer hover:border-primary/50 transition-colors group">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="h-5 w-5 text-destructive" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold truncate">{liability.name}</h3>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {LIABILITY_LABELS[liability.type]}
                            </p>

                            <div className="mt-3">
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-muted-foreground">Balance</span>
                                <span className="font-medium">
                                  {formatCurrency(liability.currentBalance)}
                                </span>
                              </div>

                              {hasAmortizationData && (
                                <>
                                  <div className="w-full bg-muted rounded-full h-2 mb-3">
                                    <div
                                      className="bg-primary h-2 rounded-full transition-all"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>

                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      {(liability.interestRate * 100).toFixed(2)}% APR
                                    </span>
                                    <span className="text-muted-foreground">
                                      {formatCurrencyPrecise(liability.minimumPayment)}/mo
                                    </span>
                                  </div>

                                  {payoffDate && (
                                    <div className="flex items-center gap-1 mt-2 text-sm">
                                      <Calendar className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-muted-foreground">Payoff:</span>
                                      <span className="font-medium text-primary">
                                        {formatDate(payoffDate)}
                                      </span>
                                    </div>
                                  )}

                                  {liability.extraPaymentMonthly && liability.extraPaymentMonthly > 0 && (
                                    <div className="flex items-center gap-1 mt-1 text-sm text-success">
                                      <TrendingDown className="h-3 w-3" />
                                      <span>+{formatCurrencyPrecise(liability.extraPaymentMonthly)} extra/mo</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : !unlinkedLoanAccounts?.length ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2">No liabilities</h2>
                  <p className="text-muted-foreground">
                    Add a loan or mortgage account to track liabilities
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Unlinked Loan Accounts */}
          {unlinkedLoanAccounts && unlinkedLoanAccounts.length > 0 && (
            <div className={liabilities && liabilities.length > 0 ? "mt-8" : ""}>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-warning" />
                <h2 className="text-lg font-semibold">Loan Accounts Missing Details</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                These loan accounts need loan details to calculate payoff dates and amortization schedules.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unlinkedLoanAccounts.map((account) => {
                  const Icon = account.type === "mortgage" ? Home : Wallet;
                  return (
                    <Card key={account._id} className="border-warning/50">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="h-5 w-5 text-warning" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{account.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {account.institution}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {account.type === "mortgage" ? "Mortgage" : "Loan"}
                            </p>
                            <Button
                              size="sm"
                              className="mt-3 w-full"
                              onClick={() =>
                                setSetupAccount({
                                  id: account._id,
                                  name: account.name,
                                  type: account.type,
                                })
                              }
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Loan Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Setup Loan Details Dialog */}
      <Dialog
        open={!!setupAccount}
        onClose={() => {
          setSetupAccount(null);
          setFormData(initialFormData);
        }}
      >
        <DialogCloseButton
          onClose={() => {
            setSetupAccount(null);
            setFormData(initialFormData);
          }}
        />
        <DialogHeader>
          <DialogTitle>Add Loan Details for {setupAccount?.name}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSetupLiability} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Original Loan Amount *
                </label>
                <Input
                  type="number"
                  value={formData.originalAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, originalAmount: e.target.value })
                  }
                  placeholder="250000"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Current Balance
                </label>
                <Input
                  type="number"
                  value={formData.currentBalance}
                  onChange={(e) =>
                    setFormData({ ...formData, currentBalance: e.target.value })
                  }
                  placeholder="Same as original if blank"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Interest Rate (%) *
                </label>
                <Input
                  type="number"
                  value={formData.interestRate}
                  onChange={(e) =>
                    setFormData({ ...formData, interestRate: e.target.value })
                  }
                  placeholder="6.5"
                  min="0"
                  max="100"
                  step="0.001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Term (Years) *
                </label>
                <Input
                  type="number"
                  value={formData.termYears}
                  onChange={(e) =>
                    setFormData({ ...formData, termYears: e.target.value })
                  }
                  placeholder="30"
                  min="1"
                  max="50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Loan Start Date
              </label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
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
                onClick={() => {
                  setSetupAccount(null);
                  setFormData(initialFormData);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Liability"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
