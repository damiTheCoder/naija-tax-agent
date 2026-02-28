import type { BudgetTemplate } from "@/lib/budgeting/types";

export const DEFAULT_BUDGET_TEMPLATES: BudgetTemplate[] = [
  {
    id: "tpl-startup",
    name: "Startup Budget",
    description: "Lean spending template for early-stage startups.",
    period: "monthly",
    defaultAmount: 3_000_000,
    categories: [
      { category: "Payroll", share: 0.35, accountCodes: ["5500", "5510"], department: "People" },
      { category: "Marketing", share: 0.2, accountCodes: ["6000"], department: "Marketing" },
      { category: "Operations", share: 0.2, accountCodes: ["5600", "5610", "5820"], department: "Operations" },
      { category: "Technology", share: 0.15, accountCodes: ["5620"], department: "Engineering" },
      { category: "Contingency", share: 0.1, accountCodes: [], department: "Finance" },
    ],
  },
  {
    id: "tpl-small-business",
    name: "Small Business Budget",
    description: "Balanced budget structure for SMEs.",
    period: "quarterly",
    defaultAmount: 12_000_000,
    categories: [
      { category: "Inventory / COGS", share: 0.35, accountCodes: ["5000", "5010", "5060"], department: "Operations" },
      { category: "Payroll", share: 0.25, accountCodes: ["5500"], department: "People" },
      { category: "Rent & Utilities", share: 0.2, accountCodes: ["5600", "5610"], department: "Operations" },
      { category: "Marketing", share: 0.12, accountCodes: ["6000"], department: "Marketing" },
      { category: "Admin", share: 0.08, accountCodes: ["6030", "6010"], department: "Finance" },
    ],
  },
  {
    id: "tpl-marketing",
    name: "Marketing Budget",
    description: "Channel-focused marketing spend plan.",
    period: "monthly",
    defaultAmount: 2_000_000,
    categories: [
      { category: "Paid Ads", share: 0.45, accountCodes: ["6000"], department: "Marketing" },
      { category: "Content", share: 0.2, accountCodes: ["6000"], department: "Marketing" },
      { category: "Events", share: 0.15, accountCodes: ["6010"], department: "Marketing" },
      { category: "Tools", share: 0.12, accountCodes: ["5620"], department: "Marketing" },
      { category: "Research", share: 0.08, accountCodes: ["6020"], department: "Marketing" },
    ],
  },
  {
    id: "tpl-personal",
    name: "Personal Budget",
    description: "Simple planning template for individual cash control.",
    period: "monthly",
    defaultAmount: 500_000,
    categories: [
      { category: "Housing", share: 0.35, accountCodes: ["5600"], department: "Personal" },
      { category: "Food", share: 0.2, accountCodes: ["5820"], department: "Personal" },
      { category: "Transport", share: 0.15, accountCodes: ["6070"], department: "Personal" },
      { category: "Bills", share: 0.15, accountCodes: ["5610", "5620"], department: "Personal" },
      { category: "Savings", share: 0.15, accountCodes: [], department: "Personal" },
    ],
  },
];

export const DEFAULT_DEPARTMENTS = [
  "Marketing",
  "Engineering",
  "Operations",
  "Finance",
  "People",
  "Sales",
  "Administration",
];
