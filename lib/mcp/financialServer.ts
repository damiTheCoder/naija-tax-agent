import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { calculateMonthlyPayroll } from "@/lib/payroll/calculator";
import { loadRuleBook, type Jurisdiction } from "@/lib/taxRules/rulebook";
import type { UnifiedAgentAction } from "@/lib/agent/unifiedTypes";
import { resolveWorkspaceRouteFromText } from "@/lib/agent/routeResolver";

const jurisdictionEnum = z.enum(["Federal", "Lagos", "Ogun", "Rivers", "Kano", "Other"]);

const createLedgerEntrySchema = z.object({
  description: z.string().min(2),
  amount: z.number().positive(),
  category: z.string().optional(),
  date: z.string().optional(),
  approved: z.boolean().optional(),
});

const payrollSchema = z.object({
  employee_name: z.string().optional(),
  basic_salary: z.number().min(0),
  housing: z.number().min(0).default(0),
  transport: z.number().min(0).default(0),
  other_allowances: z.number().min(0).default(0),
});

const taxRulesSchema = z.object({
  year: z.string().default("2024"),
  jurisdiction: jurisdictionEnum.default("Federal"),
  tax_type: z.string().optional(),
});

const budgetCheckSchema = z.object({
  category: z.string().optional(),
  budget_amount: z.number().min(0),
  committed_amount: z.number().min(0).default(0),
  request_amount: z.number().min(0).default(0),
});

const routeFinderSchema = z.object({
  query: z.string().min(2),
  current_route: z.string().optional(),
  module: z.string().optional(),
});

const reportPdfSchema = z.object({
  report_type: z
    .enum([
      "trial_balance",
      "income_statement",
      "balance_sheet",
      "cashflow",
      "financial_statements",
      "financial_summary",
      "tax_payables",
    ])
    .optional(),
  description: z.string().optional(),
  business_name: z.string().optional(),
});

function text(content: string) {
  return [{ type: "text" as const, text: content }];
}

function formatNaira(amount: number): string {
  return `₦${Math.round(amount || 0).toLocaleString("en-NG")}`;
}

export function createFinancialMcpServer() {
  const server = new McpServer({
    name: "quantum-ledger-financial-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "create_ledger_entry",
    {
      title: "Create Ledger Entry",
      description:
        "Prepare a ledger posting action for accounting transactions.",
      inputSchema: createLedgerEntrySchema,
      annotations: {
        title: "Create ledger entry",
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async (args) => {
      const description = args.description.trim();
      const amount = Number(args.amount || 0);
      const payload = {
        description,
        amount,
        category: args.category || "other",
        date: args.date,
      };

      const action: UnifiedAgentAction = {
        type: "accounting.postTransaction",
        payload,
        reason: "Prepared via MCP create_ledger_entry tool",
        confidence: 0.86,
      };

      return {
        content: text("Ledger entry prepared and ready for execution."),
        structuredContent: {
          readyAction: action,
        },
      };
    }
  );

  server.registerTool(
    "calculate_payroll",
    {
      title: "Calculate Payroll",
      description:
        "Calculate Nigerian monthly payroll including PAYE, pension, NHF, and net salary.",
      inputSchema: payrollSchema,
      annotations: {
        title: "Calculate payroll",
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args) => {
      const result = calculateMonthlyPayroll({
        basicSalary: args.basic_salary,
        housing: args.housing,
        transport: args.transport,
        otherAllowances: args.other_allowances,
      });

      const name = args.employee_name?.trim() || "Employee";
      return {
        content: text(
          `${name} payroll computed. Gross ${formatNaira(result.grossIncome)}, PAYE ${formatNaira(
            result.monthlyTax
          )}, Net ${formatNaira(result.netSalary)}.`
        ),
        structuredContent: {
          employeeName: name,
          grossIncome: result.grossIncome,
          monthlyTax: result.monthlyTax,
          pensionEmployee: result.pensionEmployee,
          pensionEmployer: result.pensionEmployer,
          nhf: result.nhf,
          netSalary: result.netSalary,
          suggestion: {
            nextTool: "create_ledger_entry",
            arguments: {
              description: `Payroll disbursement for ${name}`,
              amount: result.netSalary,
              category: "salary",
            },
          },
        },
      };
    }
  );

  server.registerTool(
    "get_tax_rules",
    {
      title: "Get Tax Rules",
      description: "Fetch applicable tax rules and metadata from the configured Nigerian rulebook.",
      inputSchema: taxRulesSchema,
      annotations: {
        title: "Get tax rules",
        readOnlyHint: true,
      },
    },
    async (args) => {
      const jurisdiction = (args.jurisdiction || "Federal") as Jurisdiction;
      const rulebook = loadRuleBook(args.year || "2024", jurisdiction);
      const target = (args.tax_type || "").toLowerCase();

      const filteredRules = Object.entries(rulebook.rules)
        .filter(([key]) => (target ? key.toLowerCase().includes(target) : true))
        .slice(0, 20)
        .map(([key, value]) => ({
          key,
          type: value.type,
          description: value.description || "",
        }));

      return {
        content: text(
          `Loaded ${filteredRules.length} tax rule(s) for ${jurisdiction} ${rulebook.metadata.tax_year}.`
        ),
        structuredContent: {
          metadata: rulebook.metadata,
          rules: filteredRules,
        },
      };
    }
  );

  server.registerTool(
    "find_workspace_route",
    {
      title: "Find Workspace Route",
      description:
        "Resolve the best internal page route for the user's task (navigation, upload, filing, reports, workspace).",
      inputSchema: routeFinderSchema,
      annotations: {
        title: "Find workspace route",
        readOnlyHint: true,
      },
    },
    async (args) => {
      const resolved = resolveWorkspaceRouteFromText(
        args.query || "",
        args.current_route || "",
        args.module || ""
      );

      if (!resolved) {
        return {
          content: text("No matching route found for this request."),
          structuredContent: {
            found: false,
          },
        };
      }

      return {
        content: text(`Best route: ${resolved.route} (${resolved.label}).`),
        structuredContent: {
          found: true,
          route: resolved.route,
          label: resolved.label,
          reason: resolved.reason,
        },
      };
    }
  );

  server.registerTool(
    "prepare_report_pdf",
    {
      title: "Prepare Report PDF",
      description:
        "Prepare a report download action (PDF) for trial balance, statements, cash flow, financial summary, or tax payables.",
      inputSchema: reportPdfSchema,
      annotations: {
        title: "Prepare report PDF",
        readOnlyHint: true,
      },
    },
    async (args) => {
      const reportType = args.report_type || "financial_statements";
      const action: UnifiedAgentAction = {
        type: "report.downloadPdf",
        payload: {
          reportType,
          format: "pdf",
          description: args.description || "",
          businessName: args.business_name || "",
        },
        reason: "Prepared via MCP prepare_report_pdf tool",
        confidence: 0.9,
      };

      return {
        content: text(`Report action prepared (${reportType}).`),
        structuredContent: {
          readyAction: action,
          reportType,
        },
      };
    }
  );

  server.registerTool(
    "check_budget_funds",
    {
      title: "Check Budget Funds",
      description: "Check whether requested spending can be covered by remaining budget.",
      inputSchema: budgetCheckSchema,
      annotations: {
        title: "Check budget funds",
        readOnlyHint: true,
      },
    },
    async (args) => {
      const budgetAmount = Number(args.budget_amount || 0);
      const committed = Number(args.committed_amount || 0);
      const requestAmount = Number(args.request_amount || 0);
      const remainingBefore = budgetAmount - committed;
      const remainingAfter = remainingBefore - requestAmount;
      const canProceed = remainingAfter >= 0;
      const utilizationPercent = budgetAmount > 0 ? ((committed + requestAmount) / budgetAmount) * 100 : 0;

      return {
        content: text(
          `${args.category || "Budget"}: ${canProceed ? "within" : "outside"} limit. Remaining after request: ${formatNaira(
            remainingAfter
          )}.`
        ),
        structuredContent: {
          category: args.category || "general",
          budgetAmount,
          committedAmount: committed,
          requestAmount,
          remainingBefore,
          remainingAfter,
          utilizationPercent,
          canProceed,
          status: canProceed ? "healthy" : "over-budget",
        },
      };
    }
  );

  return server;
}
