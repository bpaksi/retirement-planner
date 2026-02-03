"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking", icon: Wallet },
  { value: "savings", label: "Savings", icon: PiggyBank },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "401k", label: "401(k)", icon: Building2 },
  { value: "403b", label: "403(b)", icon: Building2 },
  { value: "traditional_ira", label: "Traditional IRA", icon: PiggyBank },
  { value: "roth_ira", label: "Roth IRA", icon: PiggyBank },
  { value: "roth_401k", label: "Roth 401(k)", icon: Building2 },
  { value: "brokerage", label: "Brokerage", icon: Building2 },
  { value: "money_market", label: "Money Market", icon: PiggyBank },
  { value: "loan", label: "Loan", icon: CreditCard },
  { value: "other", label: "Other", icon: Wallet },
] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];

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

export default function AccountsPage() {
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteDialogAccount, setDeleteDialogAccount] = useState<{
    id: Id<"accounts">;
    name: string;
  } | null>(null);
  const [deleteTransactionsDialogAccount, setDeleteTransactionsDialogAccount] =
    useState<{
      id: Id<"accounts">;
      name: string;
    } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "checking" as AccountType,
    institution: "",
    accountNumberLast4: "",
    taxTreatment: "taxable" as TaxTreatment,
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleImportForAccount = (accountId: Id<"accounts">) => {
    router.push(`/transactions?import=true&accountId=${accountId}`);
  };

  const accounts = useQuery(api.accounts.queries.list, {});
  const createAccount = useMutation(api.accounts.mutations.create);
  const archiveAccount = useMutation(api.accounts.mutations.archive);
  const removeAccount = useMutation(api.accounts.mutations.remove);
  const removeTransactionsByAccount = useMutation(
    api.transactions.mutations.removeByAccount
  );

  // Get transaction count for the account in delete dialog
  const transactionCount = useQuery(
    api.transactions.queries.countByAccount,
    deleteDialogAccount ? { accountId: deleteDialogAccount.id } : "skip"
  );

  const transactionCountForDelete = useQuery(
    api.transactions.queries.countByAccount,
    deleteTransactionsDialogAccount
      ? { accountId: deleteTransactionsDialogAccount.id }
      : "skip"
  );

  const handleDeleteAccount = async () => {
    if (!deleteDialogAccount) return;
    setIsDeleting(true);
    try {
      await removeAccount({ id: deleteDialogAccount.id });
      setDeleteDialogAccount(null);
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
      await removeTransactionsByAccount({
        accountId: deleteTransactionsDialogAccount.id,
      });
      setDeleteTransactionsDialogAccount(null);
    } catch (error) {
      console.error("Failed to delete transactions:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveAccount = async (id: Id<"accounts">) => {
    try {
      await archiveAccount({ id });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.institution) return;

    setIsSubmitting(true);
    try {
      await createAccount({
        name: formData.name,
        type: formData.type,
        institution: formData.institution,
        accountNumberLast4: formData.accountNumberLast4 || undefined,
        taxTreatment: formData.taxTreatment,
        isRetirement: isRetirementAccount(formData.type),
        notes: formData.notes || undefined,
      });

      setShowCreateDialog(false);
      setFormData({
        name: "",
        type: "checking",
        institution: "",
        accountNumberLast4: "",
        taxTreatment: "taxable",
        notes: "",
      });
    } catch (error) {
      console.error("Failed to create account:", error);
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
                  <Card key={account._id}>
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
                            onClick={() => handleImportForAccount(account._id)}
                          >
                            <Upload className="h-4 w-4" />
                            Import Transactions
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setDeleteTransactionsDialogAccount({
                                id: account._id,
                                name: account.name,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Transactions
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleArchiveAccount(account._id)}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              setDeleteDialogAccount({
                                id: account._id,
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
                    <Card key={account._id} className="opacity-60">
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
                Account Type *
              </label>
              <Select
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value as AccountType)}
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
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
