"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  RawTransaction,
  StatementDraft,
  DraftDocumentMeta,
  AuditedStatementPacket,
  TransactionType,
} from "@/lib/accounting/types";
import { buildTransactionsFromFiles, generateStatementDraft, normaliseCategory } from "@/lib/accounting/statementEngine";
import { statementToTaxDraft } from "@/lib/accounting/taxBridge";
import { AutomationStatus, BANK_PROVIDERS, deriveWorkspaceFiles, mockAutomationClient } from "@/lib/accounting/automationAgent";
import { accountingEngine, parseTransactionFromChat, AccountingState, CustomAccount } from "@/lib/accounting/transactionBridge";
import { CHART_OF_ACCOUNTS } from "@/lib/accounting/standards";
import { clearAllData } from "@/lib/utils/system";
import { JournalEntry } from "@/lib/accounting/doubleEntry";
import { useTheme } from "@/lib/ThemeContext";
import { EmptyChat, SkeletonList, EmptyTransactions } from "@/components/ui";

type ManualTransactionDraft = {
  date: string;
  description: string;
  category: string;
  amount: string;
  type: TransactionType;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

type AutomationLogEntry = {
  title: string;
  detail: string;
  timestamp: string;
};

const automationPrompts = [
  "Explain payroll variance",
  "Reclassify this rent payment",
  "Spot duplicate POS entries",
  "Summarise audit-ready figures",
];

const initialTransaction: ManualTransactionDraft = {
  date: "",
  description: "",
  category: "sales",
  amount: "",
  type: "income" as const,
};

export default function AccountingPage() {
  const { theme } = useTheme();
  // -- State for Documents & Automation --
  const [documents, setDocuments] = useState<DraftDocumentMeta[]>([]);
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [manualTx, setManualTx] = useState<ManualTransactionDraft>(initialTransaction);
  const [generatedStatements, setGeneratedStatements] = useState<StatementDraft | null>(null);
  const [auditedPacket, setAuditedPacket] = useState<AuditedStatementPacket | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Drop ledgers, invoices or bank exports and I'll start preparing draft statements.",
      timestamp: Date.now(),
    },
  ]);
  const [composerInput, setComposerInput] = useState("");
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false);
  const workspaceScrollRestore = useRef<number | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus>("idle");
  const [selectedBank, setSelectedBank] = useState(BANK_PROVIDERS[0]);
  const [automationConfidence, setAutomationConfidence] = useState(0.82);
  const [automationActivity, setAutomationActivity] = useState<AutomationLogEntry[]>([
    {
      title: "Workspace ready",
      detail: "Connect a bank feed to start streaming journals automatically.",
      timestamp: "Awaiting action",
    },
  ]);
  const [isAutomationBusy, setIsAutomationBusy] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [accountingState, setAccountingState] = useState<AccountingState | null>(null);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  const auditUploadRef = useRef<HTMLInputElement | null>(null);
  const manualFormRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Post Entry Section State
  type PostEntryLine = { id: string; accountCode: string; accountName: string; debit: string; credit: string };
  const [showPostEntry, setShowPostEntry] = useState(false);
  const [postEntryNarration, setPostEntryNarration] = useState("");
  const [postEntryDate, setPostEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [postEntryLines, setPostEntryLines] = useState<PostEntryLine[]>([
    { id: "1", accountCode: "", accountName: "", debit: "", credit: "" },
    { id: "2", accountCode: "", accountName: "", debit: "", credit: "" },
  ]);
  const [postEntryError, setPostEntryError] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<{ isValid?: boolean; fixed?: boolean; reasoning?: string; suggestedCorrections?: { lines: Array<{ accountCode: string; accountName: string; debit: number; credit: number }> } } | null>(null);


  // Edit Entry Section State
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showEditEntry, setShowEditEntry] = useState(false);
  const [editEntryNarration, setEditEntryNarration] = useState("");
  const [editEntryDate, setEditEntryDate] = useState("");
  type EditEntryLine = { id: string; accountCode: string; accountName: string; debit: string; credit: string };
  const [editEntryLines, setEditEntryLines] = useState<EditEntryLine[]>([]);
  const [editEntryError, setEditEntryError] = useState("");

  const customAccounts = accountingState?.customAccounts || [];

  // Combine all accounts for selection
  const allAccountsForSelect = useMemo(() => {
    const standard = CHART_OF_ACCOUNTS.map((acc) => ({
      code: acc.code,
      name: acc.name,
      class: acc.class,
    }));
    const custom = customAccounts.map((acc: CustomAccount) => ({
      code: acc.code,
      name: acc.name,
      class: acc.class,
    }));
    return [...standard, ...custom].sort((a, b) => a.code.localeCompare(b.code));
  }, [customAccounts]);

  // Calculate post entry totals
  const postEntryTotals = useMemo(() => {
    const totalDebit = postEntryLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredit = postEntryLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
    return { totalDebit, totalCredit, isBalanced };
  }, [postEntryLines]);

  // Calculate edit entry totals
  const editEntryTotals = useMemo(() => {
    const totalDebit = editEntryLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredit = editEntryLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
    return { totalDebit, totalCredit, isBalanced };
  }, [editEntryLines]);

  const handleAIAudit = async () => {
    if (!postEntryNarration) {
      setPostEntryError("Please enter a narration first.");
      return;
    }

    setIsAuditing(true);
    setAuditResult(null);
    setPostEntryError("");

    try {
      const entryDraft = {
        date: postEntryDate,
        dateCreated: new Date().toISOString(),
        narration: postEntryNarration,
        // Map UI lines to JournalEntry lines
        lines: postEntryLines
          .filter(l => l.accountCode)
          .map(l => ({
            accountCode: l.accountCode,
            accountName: allAccountsForSelect.find(a => a.code === l.accountCode)?.name || "",
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          }))
      };

      const res = await fetch("/api/ai/audit-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: entryDraft,
          description: postEntryNarration
        })
      });

      const result = await res.json();
      setAuditResult(result);

      if (!result.isValid) {
        // Auto-expand checks if invalid
      }

    } catch (err) {
      console.error(err);
      setPostEntryError("AI Audit failed. Please try again.");
    } finally {
      setIsAuditing(false);
    }
  };

  const applyAISuggestion = () => {
    if (auditResult && auditResult.suggestedCorrections) {
      // Map back to UI lines
      const newLines = auditResult.suggestedCorrections.lines.map((l: { accountCode: string; accountName: string; debit: number; credit: number }, idx: number) => ({
        id: Date.now().toString() + idx,
        accountCode: l.accountCode,
        accountName: l.accountName,
        debit: l.debit > 0 ? l.debit.toString() : "",
        credit: l.credit > 0 ? l.credit.toString() : ""
      }));
      setPostEntryLines(newLines);
      setAuditResult({ ...auditResult, isValid: true, fixed: true }); // Mark as fixed
    }
  };


  // Auto-expand textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 24), 150);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [composerInput]);

  const workspaceFiles = useMemo(() => deriveWorkspaceFiles(transactions), [transactions]);
  const automationConfidencePercent = useMemo(() => Math.round(automationConfidence * 100), [automationConfidence]);

  // Subscribe to accounting engine and load persisted state
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Defer heavy localStorage load to allow page to render first
    const loadEngine = () => {
      accountingEngine.load();
      setAccountingState(accountingEngine.getState());
      setJournalEntries(accountingEngine.getState().journalEntries);
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(loadEngine);
    } else {
      setTimeout(loadEngine, 0);
    }

    // Subscribe to updates from the engine
    const unsubscribe = accountingEngine.subscribe((state) => {
      setAccountingState(state);
      setJournalEntries(state.journalEntries);
    });

    // Listen for custom accounting-update events (from chat transactions)
    const handleAccountingUpdate = () => {
      console.log("[Accounting Page] Received accounting-update event, refreshing state...");
      accountingEngine.load(); // Reload from localStorage to get latest data
      const state = accountingEngine.getState();
      setAccountingState(state);
      setJournalEntries(state.journalEntries);

      // Also regenerate financial statements
      const statements = accountingEngine.generateStatements();
      setGeneratedStatements(statements);
      console.log("[Accounting Page] Statements regenerated:", statements);
    };
    window.addEventListener("accounting-update", handleAccountingUpdate);

    // Also listen for storage events for cross-tab sync
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "insight::accounting-engine") {
        console.log("[Accounting Page] Storage event detected, reloading engine...");
        accountingEngine.load();
        handleAccountingUpdate();
      }
    };
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      unsubscribe();
      window.removeEventListener("accounting-update", handleAccountingUpdate);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTransactions = window.localStorage.getItem("insight::accounting-transactions");
    if (savedTransactions) {
      try {
        const parsed = JSON.parse(savedTransactions);
        if (Array.isArray(parsed)) {
          setTransactions(parsed);
        }
      } catch {
        // ignore malformed cache
      }
    }
    const savedConfidence = window.localStorage.getItem("insight::automation-confidence");
    if (savedConfidence) {
      const numeric = parseFloat(savedConfidence);
      if (!Number.isNaN(numeric)) {
        setAutomationConfidence(numeric);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("insight::accounting-transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("insight::automation-confidence", automationConfidence.toString());
  }, [automationConfidence]);

  useEffect(() => {
    if (transactions.length > 0 && automationStatus === "idle") {
      setAutomationStatus("live");
    }
  }, [transactions.length, automationStatus]);

  useEffect(() => {
    if (workspaceScrollRestore.current !== null && typeof window !== "undefined") {
      window.scrollTo({ top: workspaceScrollRestore.current });
      workspaceScrollRestore.current = null;
    }
  }, [isWorkspaceCollapsed]);

  const pushAutomationActivity = (title: string, detail: string) => {
    const timestamp = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
    setAutomationActivity((prev) => [{ title, detail, timestamp }, ...prev].slice(0, 4));
  };

  const handleAutomationPrompt = (prompt: string) => {
    appendMessage("user", prompt);
    appendMessage(
      "assistant",
      `Working on "${prompt}". I'll tag the journal entries and update the workspace cards for you.`,
    );
    pushAutomationActivity("Prompt queued", `Agent is handling: ${prompt}`);
  };

  const connectBankFeed = async () => {
    setIsAutomationBusy(true);
    setAutomationStatus("connecting");
    pushAutomationActivity("Connecting feed", `Authorising ${selectedBank}...`);
    appendMessage("assistant", `🔌 Connecting securely to ${selectedBank}...`);
    try {
      const update = await mockAutomationClient.connectBank(selectedBank);
      setAutomationStatus(update.status);
      pushAutomationActivity("Bank linked", update.message);
      appendMessage("assistant", `🤝 ${update.message}`);
    } finally {
      setIsAutomationBusy(false);
    }
  };

  const triggerAutomationSync = async () => {
    setIsAutomationBusy(true);
    setAutomationStatus("syncing");
    pushAutomationActivity("Syncing entries", "Streaming latest 24h from your bank feed.");
    appendMessage("assistant", `📡 Streaming the latest data from ${selectedBank}...`);
    try {
      const update = await mockAutomationClient.runSync(transactions, selectedBank);
      if (update.generatedTransactions?.length) {
        setTransactions((prev) => [...prev, ...update.generatedTransactions!]);
      }
      setAutomationStatus(update.status);
      setAutomationConfidence((prev) => Math.min(0.99, prev + 0.03));
      pushAutomationActivity("New journals", update.message);
      appendMessage("assistant", `✅ ${update.message} Feel free to edit or reclassify any of them right here.`);
    } finally {
      setIsAutomationBusy(false);
    }
  };

  const appendMessage = (role: "user" | "assistant", content: string) => {
    setMessages((prev) => [...prev, { role, content, timestamp: Date.now() }]);
  };

  const handleSendMessage = async () => {
    const trimmed = composerInput.trim();
    if (!trimmed) return;
    appendMessage("user", trimmed);
    setComposerInput("");
    setIsWorkspaceCollapsed(true);

    // First, try local parsing for immediate feedback
    const localParsed = parseTransactionFromChat(trimmed);

    // If we have an amount, try AI validation
    if (localParsed && localParsed.amount && localParsed.amount > 0) {
      try {
        // Call AI validation API
        const response = await fetch('/api/accounting/validate-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionText: trimmed,
            amount: localParsed.amount
          })
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.result) {
          const aiResult = data.result;

          // Map parsedType to transaction type
          const typeMap: Record<string, "income" | "expense" | "asset" | "liability" | "equity"> = {
            'sale': 'income',
            'receipt': 'income',
            'purchase': 'expense',
            'expense': 'expense',
            'payment': 'liability',
            'transfer': 'asset',
            'asset': 'asset',
            'equity': 'equity',
            'loan': 'liability',
            'other': 'expense',
          };

          const transactionType = typeMap[aiResult.parsedType] || 'expense';

          const newTransaction: RawTransaction = {
            id: `chat-ai-${Date.now()}`,
            date: new Date().toISOString().split("T")[0],
            description: aiResult.description || trimmed.substring(0, 150),
            category: aiResult.category || "other",
            amount: aiResult.amount,
            type: transactionType,
          };

          // Show AI validation info
          const aiStatusIcon = aiResult.aiCorrected ? "🤖✓" : "✓";
          const confidenceText = aiResult.confidence >= 0.9 ? `${aiStatusIcon} AI High confidence` :
            aiResult.confidence >= 0.7 ? `${aiStatusIcon} AI Medium confidence` : `⚠️ Low confidence`;

          // Show account info
          const accountInfo = aiResult.debitAccount && aiResult.creditAccount ?
            `\n📘 **DR ${aiResult.debitAccount.code}** ${aiResult.debitAccount.name}\n📕 **CR ${aiResult.creditAccount.code}** ${aiResult.creditAccount.name}` : '';

          // Show AI corrections if any
          const correctionInfo = aiResult.aiCorrected ?
            `\n\n🤖 _AI Correction Applied: ${aiResult.aiReasoning}_` : '';

          // Show tax implications if any
          const taxInfo = [];
          if (aiResult.taxImplications.outputVAT > 0) taxInfo.push(`VAT: ₦${aiResult.taxImplications.outputVAT.toLocaleString()}`);
          if (aiResult.taxImplications.wht > 0) taxInfo.push(`WHT: ₦${aiResult.taxImplications.wht.toLocaleString()}`);
          if (aiResult.taxImplications.paye > 0) taxInfo.push(`PAYE: ₦${aiResult.taxImplications.paye.toLocaleString()}`);
          if (aiResult.taxImplications.cgt > 0) taxInfo.push(`CGT: ₦${aiResult.taxImplications.cgt.toLocaleString()}`);
          const taxLine = taxInfo.length > 0 ? `\n💰 Tax: ${taxInfo.join(' | ')}` : '';

          try {
            const result = accountingEngine.processTransaction(newTransaction);
            setTransactions((prev) => [...prev, newTransaction]);

            // Enhanced response with AI validation info
            const enhancedResponse = `${result.chatResponse}${accountInfo}${taxLine}${correctionInfo}\n\n_${confidenceText} (${aiResult.processingTimeMs}ms)_`;
            appendMessage("assistant", enhancedResponse);
            pushAutomationActivity("AI-Validated Journal", `Parsed and posted: ${result.journalEntry.id}`);

            // Auto-update statements
            const engineStatements = accountingEngine.generateStatements();
            setGeneratedStatements(engineStatements);
          } catch {
            appendMessage(
              "assistant",
              `I detected a ${aiResult.parsedType} transaction (₦${aiResult.amount.toLocaleString()}).${accountInfo}${taxLine}\n\n${confidenceText}.\n\nUse the manual form above for full control, or I can journal it with assumptions.`,
            );
          }
        } else {
          // AI validation didn't return a result, fall back to local parsing
          throw new Error('No AI result');
        }
      } catch (aiError) {
        console.log('[AI Validation] Falling back to local parsing:', aiError);

        // Fall back to original local parsing logic
        const typeMap: Record<string, "income" | "expense" | "asset" | "liability" | "equity"> = {
          'sale': 'income',
          'receipt': 'income',
          'purchase': 'expense',
          'expense': 'expense',
          'payment': 'liability',
          'transfer': 'asset',
          'asset': 'asset',
          'equity': 'equity',
          'loan': 'liability',
          'other': 'expense',
        };

        const categoryToType: Record<string, "income" | "expense" | "asset" | "liability" | "equity"> = {
          'sales': 'income',
          'service': 'income',
          'receipt': 'income',
          'purchases': 'expense',
          'rent': 'expense',
          'salary': 'expense',
          'utilities': 'expense',
          'transport': 'expense',
          'expense': 'expense',
          'asset': 'asset',
          'capital': 'equity',
          'drawing': 'equity',
          'loan-received': 'liability',
          'loan-repayment': 'liability',
          'supplier-payment': 'liability',
          'payment': 'liability',
          'transfer': 'asset',
        };

        const transactionType = categoryToType[localParsed.category || ''] || typeMap[localParsed.parsedType] || 'expense';

        const newTransaction: RawTransaction = {
          id: `chat-${Date.now()}`,
          date: new Date().toISOString().split("T")[0],
          description: localParsed.description || trimmed.substring(0, 150),
          category: localParsed.category || "other",
          amount: localParsed.amount,
          type: transactionType,
        };

        const confidenceText = localParsed.confidence >= 0.9 ? "✓ High confidence" :
          localParsed.confidence >= 0.7 ? "⚡ Medium confidence" : "⚠️ Low confidence";

        try {
          const result = accountingEngine.processTransaction(newTransaction);
          setTransactions((prev) => [...prev, newTransaction]);

          const enhancedResponse = `${result.chatResponse}\n\n_${confidenceText} (${localParsed.parsedType} detected - local only)_`;
          appendMessage("assistant", enhancedResponse);
          pushAutomationActivity("Chat journal", `Parsed and posted: ${result.journalEntry.id}`);

          const engineStatements = accountingEngine.generateStatements();
          setGeneratedStatements(engineStatements);
        } catch {
          appendMessage(
            "assistant",
            `I detected a ${localParsed.parsedType} transaction (₦${localParsed.amount.toLocaleString()}). ${confidenceText}.\n\nUse the manual form above for full control, or I can journal it with assumptions.`,
          );
        }
      }
    } else {
      // General chat message
      appendMessage(
        "assistant",
        "Noted. Use the + menu to upload evidence or trigger automations while I prepare the books.",
      );
    }
  };

  const handleDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const list = Array.from(files).map((file) => ({
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      status: "processed" as const,
    }));
    setDocuments((prev) => [...prev, ...list]);

    const newTransactions = buildTransactionsFromFiles(Array.from(files));
    setTransactions((prev) => [...prev, ...newTransactions]);
    setStatus(`Extracted ${newTransactions.length} transactions from uploads.`);
    appendMessage(
      "assistant",
      `📎 Processed ${files.length} document(s) and extracted ${newTransactions.length} transactions. Ready for draft generation.`,
    );
    setIsActionMenuOpen(false);
  };

  const handleManualTransactionAdd = () => {
    if (!manualTx.date || !manualTx.description || !manualTx.amount) {
      setError("Please provide date, description, and amount for the transaction.");
      return;
    }
    const amount = parseFloat(manualTx.amount);
    if (isNaN(amount)) {
      setError("Invalid amount");
      return;
    }

    const newTransaction: RawTransaction = {
      id: `manual-${Date.now()}`,
      date: manualTx.date,
      description: manualTx.description,
      category: manualTx.category,
      amount,
      type: manualTx.type,
    };

    // Process through the accounting engine for proper double-entry
    try {
      const result = accountingEngine.processTransaction(newTransaction);
      setTransactions((prev) => [...prev, newTransaction]);
      setManualTx(initialTransaction);
      setError(null);

      // Show the journal entry in chat
      appendMessage("assistant", result.chatResponse);

      // Update automation activity
      pushAutomationActivity(
        "Journal posted",
        `${result.journalEntry.id}: ${newTransaction.description}`
      );

      // Auto-update statements from engine
      const engineStatements = accountingEngine.generateStatements();
      setGeneratedStatements(engineStatements);
    } catch (err) {
      // Fallback to simple recording if engine fails
      setTransactions((prev) => [...prev, newTransaction]);
      setManualTx(initialTransaction);
      setError(null);
      appendMessage(
        "assistant",
        `Journaled ${newTransaction.description} (${newTransaction.category}) for ₦${Math.abs(amount).toLocaleString()}.`,
      );
    }
  };

  const handleGenerateStatements = () => {
    if (transactions.length === 0) {
      setError("Upload or add at least one transaction before generating statements.");
      return;
    }
    const draft = generateStatementDraft(transactions);
    setGeneratedStatements(draft);
    setStatus("Draft statements generated. Awaiting audit upload.");
    setError(null);
    appendMessage(
      "assistant",
      `📊 Draft ready — Net income ₦${draft.netIncome.toLocaleString()}, Assets ₦${draft.assets.toLocaleString()}, Liabilities ₦${draft.liabilities.toLocaleString()}. Upload the audit pack when it lands.`,
    );
  };

  const handleAuditedUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fallback = generatedStatements || generateStatementDraft(transactions);
    setAuditedPacket({
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      auditorName: "External Auditor",
      notes: "Auto-tagged demo upload",
      figures: fallback,
    });
    setStatus(`Audited statement ${file.name} ready for tax handoff.`);
    appendMessage("assistant", `🧾 Audited pack "${file.name}" attached. Queue it for the tax computation when ready.`);
    setIsActionMenuOpen(false);
  };

  const handleSendToTaxCalculator = () => {
    if (!auditedPacket) {
      setError("Upload audited statements before exporting to tax.");
      return;
    }
    const payload = statementToTaxDraft(auditedPacket.figures);
    if (typeof window !== "undefined") {
      localStorage.setItem("insight::accounting-draft", JSON.stringify(payload));
    }
    setStatus("Audited figures queued. Open the main calculator to import draft values.");
    setError(null);
    appendMessage(
      "assistant",
      "✅ Audited figures queued for the tax engine. Accept the import prompt on the main calculator dashboard.",
    );
    setIsActionMenuOpen(false);
  };

  const statementCards = generatedStatements || auditedPacket?.figures;

  const automationPrimaryAction = automationStatus === "idle" ? connectBankFeed : triggerAutomationSync;
  const automationPrimaryLabel = automationStatus === "idle" ? "Connect bank feed" : "Sync latest data";
  const automationStatusThemes: Record<AutomationStatus, string> = {
    idle: "bg-slate-100 text-slate-700",
    connecting: "bg-amber-100 text-amber-700",
    syncing: "bg-blue-100 text-blue-700",
    live: "bg-emerald-100 text-emerald-700",
  };

  const scrollToJournal = () => {
    manualFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setIsActionMenuOpen(false);
  };

  // Post Entry handlers
  const handlePostEntry = () => {
    setPostEntryError("");
    if (!postEntryNarration.trim()) {
      setPostEntryError("Please enter a narration");
      return;
    }
    if (!postEntryTotals.isBalanced) {
      setPostEntryError("Entry must be balanced (Total DR = Total CR)");
      return;
    }

    try {
      const entry = accountingEngine.postManualJournalEntry({
        narration: postEntryNarration,
        date: postEntryDate,
        lines: postEntryLines
          .filter((l) => l.accountCode && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
          .map((l) => ({
            accountCode: l.accountCode,
            accountName: l.accountName,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          })),
      });

      appendMessage("assistant", `✅ Posted journal entry ${entry.id}: ${postEntryNarration}`);
      pushAutomationActivity("Manual entry", `Posted: ${entry.id}`);

      // Reset form
      setShowPostEntry(false);
      setPostEntryNarration("");
      setPostEntryDate(new Date().toISOString().split("T")[0]);
      setPostEntryLines([
        { id: "1", accountCode: "", accountName: "", debit: "", credit: "" },
        { id: "2", accountCode: "", accountName: "", debit: "", credit: "" },
      ]);
    } catch (err: unknown) {
      setPostEntryError(err instanceof Error ? err.message : "Failed to post entry");
    }
  };

  const addPostEntryLine = () => {
    setPostEntryLines([
      ...postEntryLines,
      { id: Date.now().toString(), accountCode: "", accountName: "", debit: "", credit: "" },
    ]);
  };

  const updatePostEntryLine = (id: string, field: string, value: string) => {
    setPostEntryLines(
      postEntryLines.map((l) => {
        if (l.id !== id) return l;
        if (field === "accountCode") {
          const account = allAccountsForSelect.find((a) => a.code === value);
          return { ...l, accountCode: value, accountName: account?.name || "" };
        }
        return { ...l, [field]: value };
      })
    );
  };

  const removePostEntryLine = (id: string) => {
    if (postEntryLines.length > 2) {
      setPostEntryLines(postEntryLines.filter((l) => l.id !== id));
    }
  };

  // Edit Entry handlers
  const openEditEntry = (entry: JournalEntry) => {
    setEditingEntryId(entry.id);
    setEditEntryNarration(entry.narration);
    setEditEntryDate(entry.date);
    setEditEntryLines(
      entry.lines.map((line, idx) => ({
        id: idx.toString(),
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: line.debit > 0 ? line.debit.toString() : "",
        credit: line.credit > 0 ? line.credit.toString() : "",
      }))
    );
    setEditEntryError("");
    setShowEditEntry(true);
  };

  const handleSaveEditEntry = () => {
    setEditEntryError("");
    if (!editEntryNarration.trim()) {
      setEditEntryError("Please enter a narration");
      return;
    }
    if (!editEntryTotals.isBalanced) {
      setEditEntryError("Entry must be balanced (Total DR = Total CR)");
      return;
    }
    if (!editingEntryId) {
      setEditEntryError("No entry selected for editing");
      return;
    }

    try {
      const updatedEntry = accountingEngine.updateJournalEntry(editingEntryId, {
        narration: editEntryNarration,
        date: editEntryDate,
        lines: editEntryLines
          .filter((l) => l.accountCode && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
          .map((l) => ({
            accountCode: l.accountCode,
            accountName: l.accountName,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          })),
      });

      appendMessage("assistant", `✅ Updated journal entry ${updatedEntry.id}: ${editEntryNarration}`);
      pushAutomationActivity("Entry updated", `Updated: ${updatedEntry.id}`);

      // Reset form and close modal
      setShowEditEntry(false);
      setEditingEntryId(null);
      setEditEntryNarration("");
      setEditEntryDate("");
      setEditEntryLines([]);
    } catch (err: unknown) {
      setEditEntryError(err instanceof Error ? err.message : "Failed to update entry");
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    console.log("[Delete] Attempting to delete entry:", entryId);

    if (!confirm("Are you sure you want to delete this journal entry? This will reverse all related ledger entries.")) {
      console.log("[Delete] User cancelled");
      return;
    }

    try {
      console.log("[Delete] Calling deleteJournalEntry...");
      accountingEngine.deleteJournalEntry(entryId);
      console.log("[Delete] Entry deleted successfully, refreshing state...");

      // Force refresh state from engine after delete
      const updatedState = accountingEngine.getState();
      setAccountingState(updatedState);
      setJournalEntries(updatedState.journalEntries);

      appendMessage("assistant", `🗑️ Deleted journal entry ${entryId}`);
      pushAutomationActivity("Entry deleted", `Deleted: ${entryId}`);
      console.log("[Delete] State refreshed, entries count:", updatedState.journalEntries.length);
    } catch (err: unknown) {
      console.error("[Delete] Error:", err);
      appendMessage("assistant", `❌ Failed to delete entry: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const addEditEntryLine = () => {
    setEditEntryLines([
      ...editEntryLines,
      { id: Date.now().toString(), accountCode: "", accountName: "", debit: "", credit: "" },
    ]);
  };

  const updateEditEntryLine = (id: string, field: string, value: string) => {
    setEditEntryLines(
      editEntryLines.map((l) => {
        if (l.id !== id) return l;
        if (field === "accountCode") {
          const account = allAccountsForSelect.find((a) => a.code === value);
          return { ...l, accountCode: value, accountName: account?.name || "" };
        }
        return { ...l, [field]: value };
      })
    );
  };

  const removeEditEntryLine = (id: string) => {
    if (editEntryLines.length > 2) {
      setEditEntryLines(editEntryLines.filter((l) => l.id !== id));
    }
  };

  return (
    <>

      <div className="space-y-6 pb-32">
        <section className="relative min-h-[75vh]">
          <div className="flex flex-col gap-2 md:gap-3 px-2 md:px-6 py-3 md:py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-3 py-1 rounded-md ${documents.length ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                  Docs {documents.length}
                </span>
                <span className={`px-3 py-1 rounded-md ${generatedStatements ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                  Draft {generatedStatements ? "ready" : "pending"}
                </span>
                <span className={`px-3 py-1 rounded-md ${auditedPacket ? "bg-purple-50 text-purple-600" : "bg-rose-50 text-rose-500"}`}>
                  Audit {auditedPacket ? "attached" : "waiting"}
                </span>
              </div>
            </div>
          </div>

          <div className="chat-feed flex flex-col min-h-[60vh]">
            <div className="flex-1 overflow-y-auto px-2 md:px-6 pt-4 md:pt-6 pb-36 space-y-3 md:space-y-5">
              <div className="space-y-4">
                {/* Post Journal Entry Button */}
                <button
                  onClick={() => setShowPostEntry(true)}
                  className={`
                    w-full rounded-2xl border transition-all p-5 flex items-center justify-center gap-3 group
                    ${theme === 'dark'
                      ? 'border-gray-600 bg-[#0a0a0a] hover:bg-[#1a1a1a] hover:border-gray-500'
                      : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400'
                    }
                  `}
                >
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                    ${theme === 'dark'
                      ? 'bg-gray-700 group-hover:bg-gray-600'
                      : 'bg-gray-100 group-hover:bg-gray-200'
                    }
                  `}>
                    <svg
                      className="w-5 h-5 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Post Journal Entry
                    </h3>
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                      Manual double-entry with DR/CR columns
                    </p>
                  </div>
                </button>

                {/* Documents Section */}
                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-3 md:px-5 py-2 md:py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">Uploaded Documents</h3>
                          <p className="text-xs text-gray-500">{documents.length} file{documents.length !== 1 ? 's' : ''} attached</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 md:p-5">
                    {documents.length === 0 ? (
                      <div className="text-center py-6">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-500">No documents yet</p>
                        <p className="text-xs text-gray-400 mt-1">Use the + button to attach files</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {documents.map((doc) => (
                          <div key={`${doc.name}-${doc.uploadedAt}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs text-gray-700 truncate">{doc.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Transactions Section */}


                {/* Journal Entries Section - Double Entry View */}
                {journalEntries.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-3 md:px-5 py-2 md:py-4 border-b border-gray-100 bg-gray-50/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">Journal Entries</h3>
                            <p className="text-xs text-gray-500">{journalEntries.length} entries • Double-entry ledger</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Balanced
                        </span>
                      </div>
                    </div>
                    <div className="divide-y-[0.5px] divide-gray-100 dark:!divide-gray-800/50 max-h-[280px] overflow-y-auto">
                      {journalEntries.slice(-10).reverse().map((entry) => (
                        <div key={entry.id} className="p-4 hover:bg-gray-50/50 transition-colors group">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <span className="text-xs font-mono text-purple-600">{entry.id}</span>
                              <p className="text-sm font-medium text-gray-900 mt-1">{entry.narration}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 font-mono">{entry.date}</span>
                              {/* Edit/Delete buttons - always visible */}
                              <div className="flex gap-1">
                                <button
                                  onClick={() => openEditEntry(entry)}
                                  className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Edit entry"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete entry"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                          <table className="w-full text-xs mt-2">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                                <th className="py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Debit</th>
                                <th className="py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Credit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {entry.lines.map((line, idx) => (
                                <tr key={idx}>
                                  <td className={`py-1.5 text-gray-700 ${line.credit > 0 ? "pl-4" : ""}`}>
                                    {line.accountName}
                                  </td>
                                  <td className="py-1.5 text-right font-mono text-gray-600 w-24">
                                    {line.debit > 0 ? `₦${line.debit.toLocaleString()}` : "-"}
                                  </td>
                                  <td className="py-1.5 text-right font-mono text-gray-600 w-24">
                                    {line.credit > 0 ? `₦${line.credit.toLocaleString()}` : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Financial Statements Section removed as per user request */}

                {/* Audited Pack Section */}
                {auditedPacket && (
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white overflow-hidden">
                    <div className="px-5 py-4 border-b border-emerald-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-emerald-900">Audited Statement Pack</h3>
                          <p className="text-xs text-emerald-600">Ready for tax computation handoff</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-2">
                          <p className="text-sm font-medium text-gray-900">{auditedPacket.fileName}</p>
                          <p className="text-xs text-gray-500">
                            Uploaded {new Date(auditedPacket.uploadedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs text-gray-500">Auditor: {auditedPacket.auditorName}</p>
                          {auditedPacket.notes && <p className="text-xs text-gray-400 italic">{auditedPacket.notes}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>


      <input ref={fileUploadRef} type="file" multiple className="hidden" onChange={handleDocumentUpload} />
      <input ref={auditUploadRef} type="file" className="hidden" onChange={handleAuditedUpload} />

      {/* Post Journal Entry Modal */}
      {showPostEntry && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Post Journal Entry</h2>
                  <p className="text-sm text-gray-500">Create a double-entry transaction</p>
                </div>
              </div>
              <button
                onClick={() => setShowPostEntry(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={postEntryDate}
                    onChange={(e) => setPostEntryDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Narration</label>
                  <input
                    type="text"
                    value={postEntryNarration}
                    onChange={(e) => setPostEntryNarration(e.target.value)}
                    placeholder="e.g., Purchased office equipment"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Entry Lines */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Entry Lines</label>
                  <button
                    onClick={addPostEntryLine}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    + Add Line
                  </button>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Debit</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Credit</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {postEntryLines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-3">
                            <select
                              value={line.accountCode}
                              onChange={(e) => updatePostEntryLine(line.id, "accountCode", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                              <option value="">Select account...</option>
                              {allAccountsForSelect.map((acc) => (
                                <option key={acc.code} value={acc.code}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={line.debit}
                              onChange={(e) => updatePostEntryLine(line.id, "debit", e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={line.credit}
                              onChange={(e) => updatePostEntryLine(line.id, "credit", e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                          </td>
                          <td className="px-3 py-3">
                            {postEntryLines.length > 2 && (
                              <button
                                onClick={() => removePostEntryLine(line.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                        <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">
                          ₦{postEntryTotals.totalDebit.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">
                          ₦{postEntryTotals.totalCredit.toLocaleString()}
                        </td>
                        <td className="px-3 py-3">
                          {postEntryTotals.isBalanced ? (
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : postEntryTotals.totalDebit > 0 || postEntryTotals.totalCredit > 0 ? (
                            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* AI Verification Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">AI Accountant</h3>
                      <p className="text-xs text-gray-500">Verify your entry against accounting standards</p>
                    </div>
                  </div>
                  <button
                    onClick={handleAIAudit}
                    disabled={isAuditing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {isAuditing ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Analysing...
                      </>
                    ) : (
                      <>Verify Entry</>
                    )}
                  </button>
                </div>

                {/* Audit Results */}
                {auditResult && (
                  <div className={`mt-3 p-3 rounded-lg text-sm border ${auditResult.isValid || auditResult.fixed
                    ? "bg-green-50 border-green-100 text-green-800"
                    : "bg-amber-50 border-amber-100 text-amber-800"
                    }`}>
                    <div className="flex items-start gap-2">
                      {auditResult.isValid || auditResult.fixed ? (
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">
                          {auditResult.fixed ? "Entry corrected based on AI suggestions." : auditResult.reasoning}
                        </p>

                        {!auditResult.isValid && !auditResult.fixed && auditResult.suggestedCorrections && (
                          <div className="mt-2">
                            <button
                              onClick={applyAISuggestion}
                              className="text-xs font-semibold bg-white border border-amber-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-amber-50 transition-colors"
                            >
                              Apply Suggested Fix
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {postEntryError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {postEntryError}
                </div>
              )}

              {!postEntryTotals.isBalanced && postEntryTotals.totalDebit > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Entry not balanced: DR ₦{postEntryTotals.totalDebit.toLocaleString()} ≠ CR ₦{postEntryTotals.totalCredit.toLocaleString()}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowPostEntry(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handlePostEntry();
                    if (postEntryTotals.isBalanced && postEntryNarration.trim()) {
                      setShowPostEntry(false);
                    }
                  }}
                  disabled={!postEntryTotals.isBalanced || !postEntryNarration.trim()}
                  className="px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Post Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Journal Entry Modal */}
      {showEditEntry && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Edit Journal Entry</h2>
                  <p className="text-sm text-gray-500">Modify entry {editingEntryId}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditEntry(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={editEntryDate}
                    onChange={(e) => setEditEntryDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Narration</label>
                  <input
                    type="text"
                    value={editEntryNarration}
                    onChange={(e) => setEditEntryNarration(e.target.value)}
                    placeholder="e.g., Purchased office equipment"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Entry Lines */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Entry Lines</label>
                  <button
                    onClick={addEditEntryLine}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                  >
                    + Add Line
                  </button>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Debit</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Credit</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {editEntryLines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-3">
                            <select
                              value={line.accountCode}
                              onChange={(e) => updateEditEntryLine(line.id, "accountCode", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            >
                              <option value="">Select account...</option>
                              {allAccountsForSelect.map((acc) => (
                                <option key={acc.code} value={acc.code}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={line.debit}
                              onChange={(e) => updateEditEntryLine(line.id, "debit", e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={line.credit}
                              onChange={(e) => updateEditEntryLine(line.id, "credit", e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            />
                          </td>
                          <td className="px-3 py-3">
                            {editEntryLines.length > 2 && (
                              <button
                                onClick={() => removeEditEntryLine(line.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                        <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">
                          ₦{editEntryTotals.totalDebit.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">
                          ₦{editEntryTotals.totalCredit.toLocaleString()}
                        </td>
                        <td className="px-3 py-3">
                          {editEntryTotals.isBalanced ? (
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : editEntryTotals.totalDebit > 0 || editEntryTotals.totalCredit > 0 ? (
                            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {editEntryError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {editEntryError}
                </div>
              )}

              {!editEntryTotals.isBalanced && editEntryTotals.totalDebit > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Entry not balanced: DR ₦{editEntryTotals.totalDebit.toLocaleString()} ≠ CR ₦{editEntryTotals.totalCredit.toLocaleString()}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => editingEntryId && handleDeleteEntry(editingEntryId)}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete Entry
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowEditEntry(false)}
                    className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEditEntry}
                    disabled={!editEntryTotals.isBalanced || !editEntryNarration.trim()}
                    className="px-5 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
