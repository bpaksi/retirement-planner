"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  DialogCloseButton,
} from "@/components/ui/Dialog";
import {
  Plus,
  Wallet,
  Building2,
  CreditCard,
  PiggyBank,
  MoreVertical,
  Trash2,
  Archive,
  AlertTriangle,
  Upload,
  Home,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createAccount,
  updateAccount,
  archiveAccount,
  deleteAccount,
} from "@/app/actions/accounts";
import {
  createLiability,
  updateLiability,
} from "@/app/actions/liabilities";
import { deleteTransactionsByAccount } from "@/app/actions/transactions";
import {
  fetchAccounts,
  fetchTransactionCountByAccount,
  fetchLiabilityByAccount,
} from "@/app/actions/data";

type AccountType =
  | "401k"
  | "403b"
  | "traditional_ira"
  | "roth_ira"
  | "roth_401k"
  | "brokerage"
  | "checking"
  | "savings"
  | "money_market"
  | "credit_card"
  | "loan"
  | "mortgage"
  | "other";

type AccountTypeConfig = {
  value: AccountType;
  label: string;
  icon: typeof Building2;
};

type AccountTypeGroup = {
  label: string;
  types: AccountTypeConfig[];
};

// Grouped account types for the dropdown
const ACCOUNT_TYPE_GROUPS: AccountTypeGroup[] = [
  {
    label: "Investment",
    types: [
      { value: "401k", label: "401(k)", icon: Building2 },
      { value: "403b", label: "403(b)", icon: Building2 },
      { value: "traditional_ira", label: "Traditional IRA", icon: PiggyBank },
      { value: "roth_ira", label: "Roth IRA", icon: PiggyBank },
      { value: "roth_401k", label: "Roth 401(k)", icon: Building2 },
      { value: "brokerage", label: "Brokerage", icon: Building2 },
    ],
  },
  {
    label: "Cash & Banking",
    types: [
      { value: "checking", label: "Checking", icon: Wallet },
      { value: "savings", label: "Savings", icon: PiggyBank },
      { value: "money_market", label: "Money Market", icon: PiggyBank },
      { value: "credit_card", label: "Credit Card", icon: CreditCard },
    ],
  },
  {
    label: "Loans",
    types: [
      { value: "loan", label: "Loan", icon: CreditCard },
      { value: "mortgage", label: "Mortgage", icon: Home },
    ],
  },
  {
    label: "Other",
    types: [{ value: "other", label: "Other", icon: Wallet }],
  },
];

// Flat list for lookups
const ACCOUNT_TYPES: AccountTypeConfig[] = ACCOUNT_TYPE_GROUPS.flatMap(
  (group) => group.types
);

const TAX_TREATMENTS = [
  { value: "taxable", label: "Taxable" },
  { value: "tax_deferred", label: "Tax-Deferred" },
  { value: "tax_free", label: "Tax-Free" },
] as const;

type TaxTreatment = (typeof TAX_TREATMENTS)[number]["value"];

function getDefaultTaxTreatment(type: AccountType): TaxTreatment {
  switch (type) {
    case "401k":
    case "403b":
    case "traditional_ira":
      return "tax_deferred";
    case "roth_ira":
    case "roth_401k":
      return "tax_free";
    default:
      return "taxable";
  }
}

function isRetirementAccount(type: AccountType): boolean {
  return [
    "401k",
    "403b",
    "traditional_ira",
    "roth_ira",
    "roth_401k",
  ].includes(type);
}

function isLoanAccount(type: AccountType): boolean {
  return ["loan", "mortgage"].includes(type);
}

function getLiabilityType(
  accountType: AccountType
): "mortgage" | "auto_loan" | "personal_loan" | "other" {
  if (accountType === "mortgage") return "mortgage";
  if (accountType === "loan") return "personal_loan";
  return "other";
}

// Dropdown Menu Component
function DropdownMenu({
  children,
  trigger,
}: {
  children: React.ReactNode;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1 rounded-md hover:bg-muted transition-colors"
      >
        {trigger}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-popover border border-border rounded-md shadow-lg py-1">
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

function DropdownMenuItem({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-muted transition-colors",
        variant === "destructive" && "text-destructive hover:bg-destructive/10"
      )}
    >
      {children}
    </button>
  );
}

// Type for account from database
type Account = Awaited<ReturnType<typeof fetchAccounts>>[number];

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<{
    id: string;
    type: AccountType;
  } | null>(null);
  const [deleteDialogAccount, setDeleteDialogAccount] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteTransactionsDialogAccount, setDeleteTransactionsDialogAccount] =
    useState<{
      id: string;
      name: string;
    } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "checking" as AccountType,
    institution: "",
    accountNumberLast4: "",
    taxTreatment: "taxable" as TaxTreatment,
    notes: "",
    // Loan-specific fields
    originalAmount: "",
    interestRate: "",
    termYears: "",
    startDate: "",
    currentBalance: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [transactionCount, setTransactionCount] = useState<number | undefined>(undefined);
  const [transactionCountForDelete, setTransactionCountForDelete] = useState<number | undefined>(undefined);
  const [linkedLiability, setLinkedLiability] = useState<Awaited<ReturnType<typeof fetchLiabilityByAccount>> | null>(null);

  // Load accounts on mount and when data changes
  const loadAccounts = async () => {
    const data = await fetchAccounts();
    setAccounts(data);
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Load transaction count for delete dialog
  useEffect(() => {
    const loadCount = async () => {
      if (deleteDialogAccount) {
        const count = await fetchTransactionCountByAccount(deleteDialogAccount.id);
        setTransactionCount(count);
      } else {
        setTransactionCount(undefined);
      }
    };
    loadCount();
  }, [deleteDialogAccount]);

  // Load transaction count for delete transactions dialog
  useEffect(() => {
    const loadCount = async () => {
      if (deleteTransactionsDialogAccount) {
        const count = await fetchTransactionCountByAccount(deleteTransactionsDialogAccount.id);
        setTransactionCountForDelete(count);
      } else {
        setTransactionCountForDelete(undefined);
      }
    };
    loadCount();
  }, [deleteTransactionsDialogAccount]);

  // Load linked liability for edit dialog
  useEffect(() => {
    const loadLiability = async () => {
      if (editingAccount && isLoanAccount(editingAccount.type)) {
        const liability = await fetchLiabilityByAccount(editingAccount.id);
        setLinkedLiability(liability);
        if (liability) {
          setFormData((prev) => ({
            ...prev,
            originalAmount: liability.originalAmount?.toString() ?? "",
            interestRate: liability.interestRate
              ? (liability.interestRate * 100).toString()
              : "",
            termYears: liability.termMonths
              ? (liability.termMonths / 12).toString()
              : "",
            startDate: liability.startDate
              ? new Date(liability.startDate).toISOString().split("T")[0]
              : "",
            currentBalance: liability.currentBalance?.toString() ?? "",
          }));
        }
      } else {
        setLinkedLiability(null);
      }
    };
    loadLiability();
  }, [editingAccount]);

  const handleImportForAccount = (accountId: string) => {
    router.push(`/transactions?import=true&accountId=${accountId}`);
  };

  const handleDeleteAccount = async () => {
    if (!deleteDialogAccount) return;
    setIsDeleting(true);
    try {
      await deleteAccount(deleteDialogAccount.id);
      setDeleteDialogAccount(null);
      loadAccounts();
    } catch (error) {
      console.error("Failed to delete account:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteTransactions = async () => {
    if (!deleteTransactionsDialogAccount) return;
    setIsDeleting(true);
    try {
      await deleteTransactionsByAccount(deleteTransactionsDialogAccount.id);
      setDeleteTransactionsDialogAccount(null);
    } catch (error) {
      console.error("Failed to delete transactions:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveAccount = async (id: string) => {
    try {
      await archiveAccount(id);
      loadAccounts();
    } catch (error) {
      console.error("Failed to archive account:", error);
    }
  };

  const handleTypeChange = (type: AccountType) => {
    setFormData({
      ...formData,
      type,
      taxTreatment: getDefaultTaxTreatment(type),
    });
  };

  const openEditDialog = (account: Account) => {
    setFormData({
      name: account.name,
      type: account.type as AccountType,
      institution: account.institution,
      accountNumberLast4: account.accountNumberLast4 ?? "",
      taxTreatment: account.taxTreatment as TaxTreatment,
      notes: account.notes ?? "",
      // Loan fields will be populated by effect when linkedLiability loads
      originalAmount: "",
      interestRate: "",
      termYears: "",
      startDate: "",
      currentBalance: "",
    });
    setEditingAccount({ id: account.id, type: account.type as AccountType });
  };

  const closeEditDialog = () => {
    setEditingAccount(null);
    setFormData({
      name: "",
      type: "checking",
      institution: "",
      accountNumberLast4: "",
      taxTreatment: "taxable",
      notes: "",
      originalAmount: "",
      interestRate: "",
      termYears: "",
      startDate: "",
      currentBalance: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.institution) return;

    setIsSubmitting(true);
    try {
      const account = await createAccount({
        name: formData.name,
        type: formData.type,
        institution: formData.institution,
        accountNumberLast4: formData.accountNumberLast4 || undefined,
        taxTreatment: formData.taxTreatment,
        isRetirement: isRetirementAccount(formData.type),
        notes: formData.notes || undefined,
      });

      // Create linked liability for loan/mortgage accounts
      if (isLoanAccount(formData.type) && formData.originalAmount) {
        const originalAmount = parseFloat(formData.originalAmount);
        const interestRate = parseFloat(formData.interestRate) / 100; // Convert from percentage
        const termMonths = parseInt(formData.termYears) * 12;
        const startDate = formData.startDate
          ? new Date(formData.startDate).getTime()
          : Date.now();
        const currentBalance = formData.currentBalance
          ? parseFloat(formData.currentBalance)
          : originalAmount;

        // Calculate minimum payment using standard amortization formula
        const monthlyRate = interestRate / 12;
        let minimumPayment: number;
        if (monthlyRate > 0 && termMonths > 0) {
          minimumPayment = originalAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
        } else {
          minimumPayment = originalAmount / termMonths;
        }

        await createLiability({
          type: getLiabilityType(formData.type),
          name: formData.name,
          originalAmount,
          currentBalance,
          interestRate,
          termMonths,
          startDate,
          linkedAccountId: account.id,
          minimumPayment: Math.round(minimumPayment * 100) / 100,
        });
      }

      setShowCreateDialog(false);
      setFormData({
        name: "",
        type: "checking",
        institution: "",
        accountNumberLast4: "",
        taxTreatment: "taxable",
        notes: "",
        originalAmount: "",
        interestRate: "",
        termYears: "",
        startDate: "",
        currentBalance: "",
      });
      loadAccounts();
    } catch (error) {
      console.error("Failed to create account:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || !formData.name || !formData.institution) return;

    setIsSubmitting(true);
    try {
      await updateAccount({
        id: editingAccount.id,
        name: formData.name,
        institution: formData.institution,
        accountNumberLast4: formData.accountNumberLast4 || undefined,
        taxTreatment: formData.taxTreatment,
        notes: formData.notes || undefined,
      });

      // Update linked liability for loan accounts
      if (isLoanAccount(editingAccount.type) && linkedLiability) {
        const interestRate = parseFloat(formData.interestRate) / 100;
        const termMonths = parseInt(formData.termYears) * 12;
        const startDate = formData.startDate
          ? new Date(formData.startDate).getTime()
          : undefined;

        await updateLiability({
          id: linkedLiability.id,
          name: formData.name,
          originalAmount: formData.originalAmount
            ? parseFloat(formData.originalAmount)
            : undefined,
          currentBalance: formData.currentBalance
            ? parseFloat(formData.currentBalance)
            : undefined,
          interestRate: !isNaN(interestRate) ? interestRate : undefined,
          termMonths: !isNaN(termMonths) ? termMonths : undefined,
          startDate,
        });
      }

      closeEditDialog();
      loadAccounts();
    } catch (error) {
      console.error("Failed to update account:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeAccounts = accounts?.filter((a) => a.isActive) ?? [];
  const archivedAccounts = accounts?.filter((a) => !a.isActive) ?? [];

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Accounts</h1>
              <p className="text-muted-foreground mt-1">
                Manage your financial accounts
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </div>

          {/* Accounts Grid */}
          {activeAccounts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {activeAccounts.map((account) => {
                const accountType = ACCOUNT_TYPES.find(
                  (t) => t.value === account.type
                );
                const Icon = accountType?.icon ?? Wallet;

                return (
                  <Card key={account.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            {account.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {account.institution}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                              {accountType?.label ?? account.type}
                            </span>
                            {account.isRetirement && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
                                Retirement
                              </span>
                            )}
                          </div>
                          {account.accountNumberLast4 && (
                            <p className="text-xs text-muted-foreground mt-2">
                              ····{account.accountNumberLast4}
                            </p>
                          )}
                        </div>
                        <DropdownMenu
                          trigger={
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          }
                        >
                          <DropdownMenuItem
                            onClick={() => openEditDialog(account)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit Account
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleImportForAccount(account.id)}
                          >
                            <Upload className="h-4 w-4" />
                            Import Transactions
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setDeleteTransactionsDialogAccount({
                                id: account.id,
                                name: account.name,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Transactions
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleArchiveAccount(account.id)}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              setDeleteDialogAccount({
                                id: account.id,
                                name: account.name,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Account
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="mb-8">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2">No accounts yet</h2>
                  <p className="text-muted-foreground mb-4">
                    Add your first account to start tracking transactions
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Archived Accounts */}
          {archivedAccounts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                Archived Accounts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedAccounts.map((account) => {
                  const accountType = ACCOUNT_TYPES.find(
                    (t) => t.value === account.type
                  );
                  const Icon = accountType?.icon ?? Wallet;

                  return (
                    <Card key={account.id} className="opacity-60">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">
                              {account.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {account.institution}
                            </p>
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

      {/* Create Account Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
        <DialogCloseButton onClose={() => setShowCreateDialog(false)} />
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Account Type *
              </label>
              <Select
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value as AccountType)}
              >
                {ACCOUNT_TYPE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.types.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Account Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Chase Checking"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Institution *
              </label>
              <Input
                value={formData.institution}
                onChange={(e) =>
                  setFormData({ ...formData, institution: e.target.value })
                }
                placeholder="e.g., Chase, Fidelity, Vanguard"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Last 4 of Account Number
              </label>
              <Input
                value={formData.accountNumberLast4}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    accountNumberLast4: e.target.value.slice(0, 4),
                  })
                }
                placeholder="1234"
                maxLength={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                For your reference only - we never store full account numbers
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tax Treatment
              </label>
              <Select
                value={formData.taxTreatment}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    taxTreatment: e.target.value as TaxTreatment,
                  })
                }
              >
                {TAX_TREATMENTS.map((treatment) => (
                  <option key={treatment.value} value={treatment.value}>
                    {treatment.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Loan-specific fields */}
            {isLoanAccount(formData.type) && (
              <div className="border-t border-border pt-4 mt-4 space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Loan Details
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Original Amount *
                    </label>
                    <Input
                      type="number"
                      value={formData.originalAmount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          originalAmount: e.target.value,
                        })
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
                      value={formData.currentBalance}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          currentBalance: e.target.value,
                        })
                      }
                      placeholder="Leave blank if same as original"
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
                        setFormData({
                          ...formData,
                          interestRate: e.target.value,
                        })
                      }
                      placeholder="6.5"
                      min="0"
                      max="100"
                      step="0.001"
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
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <Input
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Optional notes about this account"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={!!editingAccount} onClose={closeEditDialog}>
        <DialogCloseButton onClose={closeEditDialog} />
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Account Type
              </label>
              <div className="flex h-10 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                {ACCOUNT_TYPES.find((t) => t.value === formData.type)?.label ??
                  formData.type}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Account type cannot be changed
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Account Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Chase Checking"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Institution *
              </label>
              <Input
                value={formData.institution}
                onChange={(e) =>
                  setFormData({ ...formData, institution: e.target.value })
                }
                placeholder="e.g., Chase, Fidelity, Vanguard"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Last 4 of Account Number
              </label>
              <Input
                value={formData.accountNumberLast4}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    accountNumberLast4: e.target.value.slice(0, 4),
                  })
                }
                placeholder="1234"
                maxLength={4}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tax Treatment
              </label>
              <Select
                value={formData.taxTreatment}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    taxTreatment: e.target.value as TaxTreatment,
                  })
                }
              >
                {TAX_TREATMENTS.map((treatment) => (
                  <option key={treatment.value} value={treatment.value}>
                    {treatment.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Loan-specific fields */}
            {editingAccount && isLoanAccount(editingAccount.type) && (
              <div className="border-t border-border pt-4 mt-4 space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Loan Details
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Original Amount
                    </label>
                    <Input
                      type="number"
                      value={formData.originalAmount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          originalAmount: e.target.value,
                        })
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
                      value={formData.currentBalance}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          currentBalance: e.target.value,
                        })
                      }
                      placeholder="Current balance"
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
                      value={formData.interestRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          interestRate: e.target.value,
                        })
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
                      value={formData.termYears}
                      onChange={(e) =>
                        setFormData({ ...formData, termYears: e.target.value })
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
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <Input
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Optional notes about this account"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog
        open={!!deleteDialogAccount}
        onClose={() => setDeleteDialogAccount(null)}
      >
        <DialogCloseButton onClose={() => setDeleteDialogAccount(null)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Account
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{deleteDialogAccount?.name}
            &quot;?
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          {transactionCount !== undefined && transactionCount > 0 ? (
            <div className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium">
                  This account has {transactionCount} transaction
                  {transactionCount !== 1 ? "s" : ""}.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  You must delete all transactions first, or archive the account
                  instead.
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogAccount(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (deleteDialogAccount) {
                      handleArchiveAccount(deleteDialogAccount.id);
                      setDeleteDialogAccount(null);
                    }
                  }}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Instead
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (deleteDialogAccount) {
                      setDeleteTransactionsDialogAccount({
                        id: deleteDialogAccount.id,
                        name: deleteDialogAccount.name,
                      });
                      setDeleteDialogAccount(null);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Transactions First
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. The account will be permanently
                deleted.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogAccount(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete Account"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Transactions Dialog */}
      <Dialog
        open={!!deleteTransactionsDialogAccount}
        onClose={() => setDeleteTransactionsDialogAccount(null)}
      >
        <DialogCloseButton
          onClose={() => setDeleteTransactionsDialogAccount(null)}
        />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete All Transactions
          </DialogTitle>
          <DialogDescription>
            Delete all transactions from &quot;
            {deleteTransactionsDialogAccount?.name}&quot;?
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            {transactionCountForDelete !== undefined && (
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm">
                  This will permanently delete{" "}
                  <span className="font-semibold">
                    {transactionCountForDelete}
                  </span>{" "}
                  transaction{transactionCountForDelete !== 1 ? "s" : ""}.
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. All transaction history for this
              account will be lost.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteTransactionsDialogAccount(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteTransactions}
                disabled={isDeleting || transactionCountForDelete === 0}
              >
                {isDeleting
                  ? "Deleting..."
                  : `Delete ${transactionCountForDelete ?? 0} Transaction${(transactionCountForDelete ?? 0) !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
