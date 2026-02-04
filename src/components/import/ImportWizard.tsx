"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  parseCSVFile,
  ParseResult,
  suggestColumnMapping,
  parseWithCustomMapping,
  ColumnMapping,
} from "@/lib/csv-parsers";
import {
  isEdwardJonesHoldingsFile,
  parseEdwardJonesHoldings,
  ParsedHolding,
  HoldingsParseResult,
} from "@/lib/csv-parsers/edwardJonesHoldings";
import { detectPotentialAccounts } from "@/lib/transfer-detection";
import { FileDropzone } from "./FileDropzone";
import { PreviewTable } from "./PreviewTable";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  FileCheck,
  Lightbulb,
  Plus,
  Briefcase,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

type WizardStep = "upload" | "configure" | "preview" | "import" | "complete";
type ImportType = "transactions" | "holdings";

interface ImportWizardProps {
  onComplete?: () => void;
  defaultAccountId?: Id<"accounts">;
}

// Format currency for display
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Holdings preview table component
function HoldingsPreviewTable({ holdings }: { holdings: ParsedHolding[] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-80">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="text-left p-3 font-medium">Symbol</th>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-right p-3 font-medium">Shares</th>
              <th className="text-right p-3 font-medium">Value</th>
              <th className="text-right p-3 font-medium">Cost Basis</th>
              <th className="text-left p-3 font-medium">Asset Class</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {holdings.slice(0, 20).map((holding, i) => (
              <tr key={i} className="hover:bg-muted/50">
                <td className="p-3 font-mono text-xs">{holding.symbol}</td>
                <td className="p-3 truncate max-w-[200px]" title={holding.name}>
                  {holding.name}
                </td>
                <td className="p-3 text-right font-mono text-xs">
                  {holding.shares.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}
                </td>
                <td className="p-3 text-right font-mono text-xs">
                  {formatCurrency(holding.currentValue)}
                </td>
                <td className="p-3 text-right font-mono text-xs">
                  {holding.costBasis ? formatCurrency(holding.costBasis) : "-"}
                </td>
                <td className="p-3">
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      holding.assetClass === "us_stock" &&
                        "bg-blue-500/10 text-blue-500",
                      holding.assetClass === "intl_stock" &&
                        "bg-purple-500/10 text-purple-500",
                      holding.assetClass === "bond" &&
                        "bg-green-500/10 text-green-500",
                      holding.assetClass === "cash" &&
                        "bg-gray-500/10 text-gray-500",
                      holding.assetClass === "other" &&
                        "bg-orange-500/10 text-orange-500"
                    )}
                  >
                    {holding.assetClass.replace("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {holdings.length > 20 && (
        <div className="p-3 text-center text-sm text-muted-foreground bg-muted/50">
          Showing 20 of {holdings.length} holdings
        </div>
      )}
    </div>
  );
}

export function ImportWizard({
  onComplete,
  defaultAccountId,
}: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>("upload");
  const [importType, setImportType] = useState<ImportType>("transactions");
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [holdingsResult, setHoldingsResult] =
    useState<HoldingsParseResult | null>(null);
  const [selectedAccountId, setSelectedAccountId] =
    useState<Id<"accounts"> | null>(defaultAccountId ?? null);
  const [columnMapping, setColumnMapping] = useState<Partial<ColumnMapping>>(
    {}
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    duplicates: number;
    updated?: number;
    errors: string[];
  } | null>(null);

  // Account suggestion state
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(
    new Set()
  );
  const [isCreatingAccounts, setIsCreatingAccounts] = useState(false);
  const [createdAccountsCount, setCreatedAccountsCount] = useState(0);

  const accounts = useQuery(api.accounts.queries.list, { activeOnly: true });
  const importBatch = useMutation(api.transactions.import.importBatch);
  const importHoldings = useMutation(api.holdings.import.importHoldings);
  const createAccount = useMutation(api.accounts.mutations.create);

  // Detect potential accounts from transactions
  const suggestedAccounts = useMemo(() => {
    if (!parseResult?.transactions || !accounts) return [];

    const existingAccounts = accounts.map((a) => ({
      name: a.name,
      institution: a.institution,
      type: a.type,
    }));

    return detectPotentialAccounts(parseResult.transactions, existingAccounts);
  }, [parseResult?.transactions, accounts]);

  // Initialize selected suggestions when suggestions change
  const toggleSuggestion = useCallback((key: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleCreateSuggestedAccounts = useCallback(async () => {
    if (selectedSuggestions.size === 0) return;

    setIsCreatingAccounts(true);
    let created = 0;

    try {
      for (const suggestion of suggestedAccounts) {
        const key = `${suggestion.suggestedName}-${suggestion.suggestedType}`;
        if (selectedSuggestions.has(key)) {
          await createAccount({
            name: suggestion.suggestedName,
            type: suggestion.suggestedType,
            institution: suggestion.suggestedInstitution,
            taxTreatment: "taxable",
            isRetirement: [
              "401k",
              "403b",
              "traditional_ira",
              "roth_ira",
              "roth_401k",
            ].includes(suggestion.suggestedType),
          });
          created++;
        }
      }
      setCreatedAccountsCount(created);
      setSelectedSuggestions(new Set());
    } catch (error) {
      console.error("Failed to create accounts:", error);
    } finally {
      setIsCreatingAccounts(false);
    }
  }, [selectedSuggestions, suggestedAccounts, createAccount]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);

    try {
      // Read file content to detect type
      const content = await selectedFile.text();

      // Check if this is a holdings file
      if (isEdwardJonesHoldingsFile(content)) {
        const holdingsData = parseEdwardJonesHoldings(content);
        setHoldingsResult(holdingsData);
        setImportType("holdings");
        setParseResult(null);
      } else {
        // Parse as transactions
        const result = await parseCSVFile(selectedFile);
        setParseResult(result);
        setImportType("transactions");
        setHoldingsResult(null);

        // If no parser detected, suggest column mapping
        if (!result.parser && result.headers.length > 0) {
          const suggested = suggestColumnMapping(result.headers);
          setColumnMapping(suggested);
        }
      }

      setStep("configure");
    } catch (error) {
      console.error("Failed to parse file:", error);
    }
  }, []);

  const handleConfigureNext = useCallback(() => {
    if (importType === "holdings") {
      setStep("preview");
      return;
    }

    if (!parseResult) return;

    // If using custom mapping, re-parse with it
    if (
      !parseResult.parser &&
      columnMapping.date &&
      columnMapping.description
    ) {
      const { transactions, errors } = parseWithCustomMapping(
        parseResult.rows,
        columnMapping as ColumnMapping
      );
      setParseResult({
        ...parseResult,
        transactions,
        errors: [...parseResult.errors, ...errors],
      });
    }

    setStep("preview");
  }, [parseResult, columnMapping, importType]);

  const handleImport = useCallback(async () => {
    if (!selectedAccountId || !file) return;

    setIsImporting(true);
    setStep("import");

    try {
      if (importType === "holdings" && holdingsResult) {
        const result = await importHoldings({
          accountId: selectedAccountId,
          holdings: holdingsResult.holdings.map((h) => ({
            symbol: h.symbol,
            name: h.name,
            shares: h.shares,
            currentValue: h.currentValue,
            costBasis: h.costBasis,
            lastPrice: h.lastPrice,
            unrealizedGainLoss: h.unrealizedGainLoss,
            assetClass: h.assetClass,
          })),
          sourceFile: file.name,
        });

        setImportResult({
          imported: result.inserted,
          duplicates: 0,
          updated: result.updated,
          errors: result.errors,
        });
      } else if (parseResult) {
        const result = await importBatch({
          accountId: selectedAccountId,
          transactions: parseResult.transactions.map((tx) => ({
            date: tx.date.getTime(),
            description: tx.description,
            amount: tx.amount,
            originalCategory: tx.originalCategory,
          })),
          sourceFile: file.name,
          institution: parseResult.parser?.institution || "Unknown",
        });

        setImportResult({
          imported: result.imported,
          duplicates: result.duplicates,
          errors: result.errors,
        });
      }

      setStep("complete");
    } catch (error) {
      console.error("Import failed:", error);
      setImportResult({
        imported: 0,
        duplicates: 0,
        errors: [error instanceof Error ? error.message : "Import failed"],
      });
      setStep("complete");
    } finally {
      setIsImporting(false);
    }
  }, [
    parseResult,
    holdingsResult,
    selectedAccountId,
    file,
    importBatch,
    importHoldings,
    importType,
  ]);

  const resetWizard = useCallback(() => {
    setStep("upload");
    setFile(null);
    setParseResult(null);
    setHoldingsResult(null);
    setSelectedAccountId(null);
    setColumnMapping({});
    setImportResult(null);
    setImportType("transactions");
    setSelectedSuggestions(new Set());
    setCreatedAccountsCount(0);
  }, []);

  const steps: { key: WizardStep; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "configure", label: "Configure" },
    { key: "preview", label: "Preview" },
    { key: "import", label: "Import" },
    { key: "complete", label: "Complete" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  // Get item count for current import type
  const itemCount =
    importType === "holdings"
      ? holdingsResult?.holdings.length ?? 0
      : parseResult?.transactions.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {steps.map((s, index) => (
          <div key={s.key} className="flex items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                index < currentStepIndex
                  ? "bg-primary text-primary-foreground"
                  : index === currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {index < currentStepIndex ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={cn(
                "ml-2 text-sm hidden sm:inline",
                index === currentStepIndex
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
            {index < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 mx-2 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6">
          {step === "upload" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold">Upload File</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload a CSV file with transactions or holdings from your
                  financial institution
                </p>
              </div>
              <FileDropzone onFileSelect={handleFileSelect} />
            </div>
          )}

          {step === "configure" && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {importType === "holdings" ? (
                    <Briefcase className="w-5 h-5 text-primary" />
                  ) : (
                    <ArrowRightLeft className="w-5 h-5 text-primary" />
                  )}
                  <h3 className="text-lg font-semibold">Configure Import</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {importType === "holdings"
                    ? `Detected holdings file from Edward Jones`
                    : parseResult?.parser
                      ? `Detected format: ${parseResult.parser.institution}`
                      : "Unknown format - please map columns manually"}
                </p>
              </div>

              {/* Account selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Import to Account
                </label>
                {accounts && accounts.length > 0 ? (
                  <Select
                    value={selectedAccountId || ""}
                    onChange={(e) =>
                      setSelectedAccountId(
                        e.target.value as Id<"accounts"> | null
                      )
                    }
                  >
                    <option value="">Select an account...</option>
                    {accounts.map((account) => (
                      <option key={account._id} value={account._id}>
                        {account.name} ({account.institution})
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                    No accounts found. Please create an account first.
                  </div>
                )}
              </div>

              {/* Column mapping for unknown transaction formats */}
              {importType === "transactions" && parseResult && !parseResult.parser && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Column Mapping</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Date Column
                      </label>
                      <Select
                        value={columnMapping.date || ""}
                        onChange={(e) =>
                          setColumnMapping({
                            ...columnMapping,
                            date: e.target.value,
                          })
                        }
                      >
                        <option value="">Select column...</option>
                        {parseResult.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Description Column
                      </label>
                      <Select
                        value={columnMapping.description || ""}
                        onChange={(e) =>
                          setColumnMapping({
                            ...columnMapping,
                            description: e.target.value,
                          })
                        }
                      >
                        <option value="">Select column...</option>
                        {parseResult.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Amount Column (or leave blank for Debit/Credit)
                      </label>
                      <Select
                        value={columnMapping.amount || ""}
                        onChange={(e) =>
                          setColumnMapping({
                            ...columnMapping,
                            amount: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Select column...</option>
                        {parseResult.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  {!columnMapping.amount && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Debit Column
                        </label>
                        <Select
                          value={columnMapping.debit || ""}
                          onChange={(e) =>
                            setColumnMapping({
                              ...columnMapping,
                              debit: e.target.value || undefined,
                            })
                          }
                        >
                          <option value="">Select column...</option>
                          {parseResult.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Credit Column
                        </label>
                        <Select
                          value={columnMapping.credit || ""}
                          onChange={(e) =>
                            setColumnMapping({
                              ...columnMapping,
                              credit: e.target.value || undefined,
                            })
                          }
                        >
                          <option value="">Select column...</option>
                          {parseResult.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">File Summary</h4>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">File:</dt>
                  <dd className="truncate">{file?.name}</dd>
                  <dt className="text-muted-foreground">Type:</dt>
                  <dd className="capitalize">{importType}</dd>
                  <dt className="text-muted-foreground">Items:</dt>
                  <dd>
                    {itemCount}{" "}
                    {importType === "holdings" ? "holdings" : "transactions"}
                  </dd>
                  {importType === "holdings" && holdingsResult && (
                    <>
                      <dt className="text-muted-foreground">Total Value:</dt>
                      <dd>{formatCurrency(holdingsResult.totalValue)}</dd>
                    </>
                  )}
                </dl>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={handleConfigureNext}
                  disabled={!selectedAccountId || itemCount === 0}
                >
                  Preview
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  Preview {importType === "holdings" ? "Holdings" : "Transactions"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {importType === "holdings"
                    ? "Review the holdings before importing. Existing holdings with matching symbols will be updated."
                    : "Review the transactions before importing. Categories will be auto-assigned where possible."}
                </p>
              </div>

              {importType === "holdings" && holdingsResult ? (
                <HoldingsPreviewTable holdings={holdingsResult.holdings} />
              ) : (
                parseResult && (
                  <PreviewTable transactions={parseResult.transactions} />
                )
              )}

              {/* Account Suggestions (transactions only) */}
              {importType === "transactions" && suggestedAccounts.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-primary font-medium mb-3">
                    <Lightbulb className="w-4 h-4" />
                    Suggested Accounts Detected
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    We found transfers that may indicate accounts you haven&apos;t
                    added yet. Select any to create them.
                  </p>

                  {createdAccountsCount > 0 && (
                    <div className="mb-4 text-sm text-success flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Created {createdAccountsCount} account
                      {createdAccountsCount !== 1 ? "s" : ""}
                    </div>
                  )}

                  <div className="space-y-2">
                    {suggestedAccounts.map((suggestion) => {
                      const key = `${suggestion.suggestedName}-${suggestion.suggestedType}`;
                      const isSelected = selectedSuggestions.has(key);

                      return (
                        <label
                          key={key}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            isSelected
                              ? "bg-primary/10 border-primary"
                              : "bg-muted/50 border-transparent hover:bg-muted"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSuggestion(key)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {suggestion.suggestedName}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                                {suggestion.suggestedType.replace("_", " ")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {suggestion.frequency} occurrence
                                {suggestion.frequency !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 truncate">
                              {suggestion.suggestedInstitution}
                            </div>
                            {suggestion.exampleDescriptions.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1 truncate">
                                e.g., {suggestion.exampleDescriptions[0]}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {selectedSuggestions.size > 0 && (
                    <Button
                      className="mt-4"
                      size="sm"
                      onClick={handleCreateSuggestedAccounts}
                      disabled={isCreatingAccounts}
                    >
                      {isCreatingAccounts ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Create {selectedSuggestions.size} Account
                          {selectedSuggestions.size !== 1 ? "s" : ""}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Parsing errors */}
              {((importType === "transactions" &&
                parseResult &&
                parseResult.errors.length > 0) ||
                (importType === "holdings" &&
                  holdingsResult &&
                  holdingsResult.errors.length > 0)) && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                    <AlertCircle className="w-4 h-4" />
                    {importType === "transactions"
                      ? parseResult?.errors.length
                      : holdingsResult?.errors.length}{" "}
                    parsing issues
                  </div>
                  <ul className="text-sm text-destructive/80 space-y-1">
                    {(importType === "transactions"
                      ? parseResult?.errors
                      : holdingsResult?.errors
                    )
                      ?.slice(0, 5)
                      .map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    {((importType === "transactions" &&
                      parseResult &&
                      parseResult.errors.length > 5) ||
                      (importType === "holdings" &&
                        holdingsResult &&
                        holdingsResult.errors.length > 5)) && (
                      <li>
                        ... and{" "}
                        {(importType === "transactions"
                          ? parseResult?.errors.length ?? 0
                          : holdingsResult?.errors.length ?? 0) - 5}{" "}
                        more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("configure")}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button onClick={handleImport}>
                  Import {itemCount}{" "}
                  {importType === "holdings" ? "Holdings" : "Transactions"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {step === "import" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <h3 className="text-lg font-semibold">
                Importing {importType === "holdings" ? "Holdings" : "Transactions"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please wait while we process your file...
              </p>
            </div>
          )}

          {step === "complete" && importResult && (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center py-6">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                    importResult.imported > 0 || (importResult.updated ?? 0) > 0
                      ? "bg-success/10"
                      : "bg-destructive/10"
                  )}
                >
                  {importResult.imported > 0 ||
                  (importResult.updated ?? 0) > 0 ? (
                    <FileCheck className="w-8 h-8 text-success" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  )}
                </div>
                <h3 className="text-lg font-semibold">
                  {importResult.imported > 0 || (importResult.updated ?? 0) > 0
                    ? "Import Complete"
                    : "Import Failed"}
                </h3>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {importType === "holdings" ? (
                    <>
                      <dt className="text-muted-foreground">New holdings:</dt>
                      <dd className="font-medium text-success">
                        {importResult.imported}
                      </dd>
                      <dt className="text-muted-foreground">Updated holdings:</dt>
                      <dd className="font-medium">
                        {importResult.updated ?? 0}
                      </dd>
                    </>
                  ) : (
                    <>
                      <dt className="text-muted-foreground">Imported:</dt>
                      <dd className="font-medium text-success">
                        {importResult.imported} transactions
                      </dd>
                      <dt className="text-muted-foreground">
                        Duplicates skipped:
                      </dt>
                      <dd>{importResult.duplicates}</dd>
                    </>
                  )}
                  {importResult.errors.length > 0 && (
                    <>
                      <dt className="text-muted-foreground">Errors:</dt>
                      <dd className="text-destructive">
                        {importResult.errors.length}
                      </dd>
                    </>
                  )}
                </dl>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                    <AlertCircle className="w-4 h-4" />
                    Import Errors
                  </div>
                  <ul className="text-sm text-destructive/80 space-y-1">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>... and {importResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex justify-center gap-4 pt-4">
                <Button variant="outline" onClick={resetWizard}>
                  Import Another File
                </Button>
                <Button onClick={onComplete}>Done</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
