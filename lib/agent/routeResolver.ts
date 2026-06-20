import { findWorkspacePageByRoute, resolveWorkspacePageFromIntent } from "@/lib/agent/workspaceRegistry";

export type ResolvedWorkspaceRoute = {
  route: string;
  label: string;
  reason: string;
};

function asResolved(route: string, label: string, reason: string): ResolvedWorkspaceRoute {
  return {
    route,
    label,
    reason,
  };
}

function resolveModuleFallbackRoute(currentRoute?: string, moduleHint?: string): string | null {
  const moduleLower = (moduleHint || "").toLowerCase();
  if ((currentRoute || "").startsWith("/tax") || moduleLower.includes("tax")) return "/tax/workspace";
  if ((currentRoute || "").startsWith("/accounting") || moduleLower.includes("accounting")) return "/accounting";
  if ((currentRoute || "").startsWith("/budgeting") || moduleLower.includes("budget")) return "/budgeting";
  if (moduleLower.includes("wallet") || moduleLower.includes("payment")) return "/accounting";
  if (moduleLower.includes("cashflow") || moduleLower.includes("cash flow")) {
    return "/accounting/projections";
  }
  return null;
}

export function resolveWorkspaceRouteFromText(
  textInput: string,
  currentRoute?: string,
  moduleHint?: string
): ResolvedWorkspaceRoute | null {
  const text = (textInput || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (/(upload|attach|submit|certificate|manual filing|tax summary)/.test(lower)) {
    if (/(withholding|wht|vat|cit|paye|tax|filing|return)/.test(lower)) {
      return asResolved("/tax/file-taxes", "File Taxes", "Tax upload or filing flow requested.");
    }
    if (/(receipt|invoice|bank statement|document)/.test(lower)) {
      return asResolved("/accounting/receipts", "Receipts", "Accounting document upload requested.");
    }
  }

  const resolvedPage = resolveWorkspacePageFromIntent(text, currentRoute, moduleHint);
  if (resolvedPage) {
    return asResolved(
      resolvedPage.route,
      resolvedPage.label,
      `Matched route by workspace capability map: ${resolvedPage.purpose}`
    );
  }

  const moduleFallbackRoute = resolveModuleFallbackRoute(currentRoute, moduleHint);
  if (moduleFallbackRoute) {
    const page = findWorkspacePageByRoute(moduleFallbackRoute);
    if (page) {
      return asResolved(page.route, page.label, "Module fallback route.");
    }
  }

  return null;
}
