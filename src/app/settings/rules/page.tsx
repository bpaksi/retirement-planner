"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchRulesWithCategories,
  fetchCategories,
  fetchTransactions,
} from "@/app/actions/data";
import type { Category } from "@/db/queries/categories";
import {
  createCategorizationRule,
  updateCategorizationRule,
  deleteCategorizationRule,
} from "@/app/actions/categorizationRules";
import { recategorizeUncategorized } from "@/app/actions/transactions";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
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
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  Search,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

// Type for rule with its related category
type RuleWithCategory = Awaited<ReturnType<typeof fetchRulesWithCategories>>[number];

type RuleFormData = {
  pattern: string;
  categoryId: string;
  priority: number;
};

type RuleStats = {
  uncategorizedCount: number;
  totalTransactions: number;
  activeRules: number;
  totalRules: number;
  systemRules: number;
  userRules: number;
  learnedRules: number;
};

type TestResult = {
  valid: boolean;
  matchCount: number;
  matches: { description: string }[];
  error?: string;
};

export default function RulesPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testPattern, setTestPattern] = useState("");
  const [formData, setFormData] = useState<RuleFormData>({
    pattern: "",
    categoryId: "",
    priority: 50,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const [rules, setRules] = useState<RuleWithCategory[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [stats, setStats] = useState<RuleStats | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [isRecategorizing, setIsRecategorizing] = useState(false);
  const [recategorizeResult, setRecategorizeResult] = useState<{
    updated: number;
    stillUncategorized: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [rulesData, categoriesData, transactionsData] = await Promise.all([
        fetchRulesWithCategories(),
        fetchCategories(),
        fetchTransactions({ limit: 10000 }),
      ]);

      setRules(rulesData);
      setCategories(categoriesData);

      // Calculate stats
      const totalTransactions = transactionsData.total;

      // Count uncategorized from full set (not just paginated)
      const uncategorizedData = await fetchTransactions({
        uncategorizedOnly: true,
        limit: 10000
      });

      setStats({
        uncategorizedCount: uncategorizedData.total,
        totalTransactions,
        activeRules: rulesData.filter((r) => r.isActive).length,
        totalRules: rulesData.length,
        systemRules: rulesData.filter((r) => r.createdBy === "system").length,
        userRules: rulesData.filter((r) => r.createdBy === "user").length,
        learnedRules: rulesData.filter((r) => r.createdBy === "learned").length,
      });
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Test pattern effect
  useEffect(() => {
    if (!testPattern) {
      setTestResult(null);
      return;
    }

    const runTest = async () => {
      try {
        // Validate regex
        new RegExp(testPattern, "i");
      } catch {
        setTestResult({
          valid: false,
          matchCount: 0,
          matches: [],
          error: "Invalid regex pattern",
        });
        return;
      }

      try {
        const transactionsData = await fetchTransactions({ limit: 10000 });
        const regex = new RegExp(testPattern, "i");
        const matches = transactionsData.transactions
          .filter((t) => regex.test(t.description))
          .slice(0, 10)
          .map((t) => ({ description: t.description }));

        const allMatches = transactionsData.transactions.filter((t) =>
          regex.test(t.description)
        );

        setTestResult({
          valid: true,
          matchCount: allMatches.length,
          matches,
        });
      } catch {
        setTestResult({
          valid: false,
          matchCount: 0,
          matches: [],
          error: "Failed to test pattern",
        });
      }
    };

    const debounce = setTimeout(runTest, 300);
    return () => clearTimeout(debounce);
  }, [testPattern]);

  const handleOpenAdd = () => {
    setFormData({ pattern: "", categoryId: "", priority: 50 });
    setFormError(null);
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (ruleId: string) => {
    const rule = rules?.find((r) => r.id === ruleId);
    if (rule) {
      setFormData({
        pattern: rule.pattern,
        categoryId: rule.categoryId,
        priority: rule.priority,
      });
      setFormError(null);
      setEditingRule(ruleId);
    }
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingRule(null);
    setFormError(null);
  };

  const validatePattern = (pattern: string): boolean => {
    try {
      new RegExp(pattern, "i");
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!formData.pattern.trim()) {
      setFormError("Pattern is required");
      return;
    }

    if (!validatePattern(formData.pattern)) {
      setFormError("Invalid regex pattern");
      return;
    }

    if (!formData.categoryId) {
      setFormError("Category is required");
      return;
    }

    try {
      if (editingRule) {
        await updateCategorizationRule({
          id: editingRule,
          pattern: formData.pattern,
          categoryId: formData.categoryId,
          priority: formData.priority,
        });
      } else {
        await createCategorizationRule({
          pattern: formData.pattern,
          categoryId: formData.categoryId,
          priority: formData.priority,
        });
      }
      handleCloseDialog();
      await loadData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save rule");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      try {
        await deleteCategorizationRule(id);
        await loadData();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to delete rule");
      }
    }
  };

  const handleToggle = async (id: string) => {
    const rule = rules?.find((r) => r.id === id);
    if (rule) {
      try {
        await updateCategorizationRule({
          id,
          isActive: !rule.isActive,
        });
        await loadData();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to toggle rule");
      }
    }
  };

  const handleRecategorize = async () => {
    setIsRecategorizing(true);
    setRecategorizeResult(null);
    try {
      const result = await recategorizeUncategorized();
      setRecategorizeResult(result);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to recategorize");
    } finally {
      setIsRecategorizing(false);
    }
  };

  const sourceLabels: Record<string, string> = {
    system: "System",
    user: "User",
    learned: "Learned",
  };

  const sourceBadgeColors: Record<string, string> = {
    system: "bg-blue-500/10 text-blue-500",
    user: "bg-green-500/10 text-green-500",
    learned: "bg-purple-500/10 text-purple-500",
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link href="/settings">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Categorization Rules</h1>
                <p className="text-muted-foreground mt-1">
                  Manage auto-categorization patterns for imported transactions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setTestDialogOpen(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                Test Pattern
              </Button>
              <Button onClick={handleOpenAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Uncategorized</p>
                <p className="text-2xl font-bold text-destructive">
                  {stats?.uncategorizedCount ?? "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  of {stats?.totalTransactions ?? "-"} transactions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold">
                  {stats?.activeRules ?? "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  of {stats?.totalRules ?? "-"} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">By Source</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">
                    {stats?.systemRules ?? 0} System
                  </span>
                  <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded">
                    {stats?.userRules ?? 0} User
                  </span>
                  <span className="text-xs bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded">
                    {stats?.learnedRules ?? 0} Learned
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Button
                  className="w-full"
                  onClick={handleRecategorize}
                  disabled={isRecategorizing || (stats?.uncategorizedCount ?? 0) === 0}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRecategorizing ? "animate-spin" : ""}`} />
                  Re-categorize All
                </Button>
                {recategorizeResult && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Updated {recategorizeResult.updated}, {recategorizeResult.stillUncategorized} remaining
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Rules Table */}
          <Card>
            <CardHeader>
              <CardTitle>Rules</CardTitle>
              <CardDescription>
                Rules are evaluated by priority (highest first). First match wins.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rules ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Active</TableHead>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="w-[80px]">Priority</TableHead>
                      <TableHead className="w-[80px]">Source</TableHead>
                      <TableHead className="w-[80px]">Matches</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id} className={!rule.isActive ? "opacity-50" : ""}>
                        <TableCell>
                          <button
                            onClick={() => handleToggle(rule.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {rule.isActive ? (
                              <ToggleRight className="h-5 w-5 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-5 w-5" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {rule.pattern}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: rule.category?.color || "#607D8B" }}
                            />
                            {rule.category?.name || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell>{rule.priority}</TableCell>
                        <TableCell>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${sourceBadgeColors[rule.createdBy]}`}
                          >
                            {sourceLabels[rule.createdBy]}
                          </span>
                        </TableCell>
                        <TableCell>{rule.matchCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(rule.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {rule.createdBy !== "system" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(rule.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {rules.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No rules configured. Add a rule to start auto-categorizing transactions.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Loading...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add/Edit Rule Dialog */}
      <Dialog open={isAddDialogOpen || editingRule !== null} onClose={handleCloseDialog}>
        <DialogCloseButton onClose={handleCloseDialog} />
        <DialogHeader>
          <DialogTitle>{editingRule ? "Edit Rule" : "Add Rule"}</DialogTitle>
          <DialogDescription>
            Define a regex pattern to match transaction descriptions.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pattern (Regex)</label>
              <Input
                value={formData.pattern}
                onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                placeholder="e.g., WALMART|TARGET|COSTCO"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use | for OR, case-insensitive matching
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <Select
                value={formData.categoryId}
                onChange={(e) =>
                  setFormData({ ...formData, categoryId: e.target.value })
                }
              >
                <option value="">Select a category...</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: parseInt(e.target.value) || 50 })
                }
                min={1}
                max={100}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Higher priority rules are evaluated first (1-100)
              </p>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {formError}
              </div>
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {editingRule ? "Save Changes" : "Add Rule"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Test Pattern Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)}>
        <DialogCloseButton onClose={() => setTestDialogOpen(false)} />
        <DialogHeader>
          <DialogTitle>Test Pattern</DialogTitle>
          <DialogDescription>
            Test a regex pattern against your transactions.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pattern</label>
              <Input
                value={testPattern}
                onChange={(e) => setTestPattern(e.target.value)}
                placeholder="e.g., WALMART|TARGET"
              />
            </div>

            {testResult && (
              <div className="space-y-2">
                {testResult.valid ? (
                  <>
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm">
                        Valid pattern - {testResult.matchCount} matches
                      </span>
                    </div>

                    {testResult.matches.length > 0 && (
                      <div className="bg-muted rounded-lg p-3 max-h-60 overflow-auto">
                        <p className="text-xs text-muted-foreground mb-2">Sample matches:</p>
                        <ul className="space-y-1">
                          {testResult.matches.map((match, i) => (
                            <li key={i} className="text-sm">
                              {match.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{testResult.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
