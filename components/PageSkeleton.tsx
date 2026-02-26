"use client";

import { usePathname } from "next/navigation";
import { Skeleton, SkeletonMetrics } from "@/components/ui/Skeleton";
import ProjectionsSkeleton from "@/components/skeletons/ProjectionsSkeleton";
import TaxWorkspaceSkeleton from "@/components/skeletons/TaxWorkspaceSkeleton";
import ChatSkeleton from "@/components/skeletons/ChatSkeleton";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import InvestmentDashboardSkeleton from "@/components/skeletons/InvestmentDashboardSkeleton";
import WalletSkeleton from "@/components/skeletons/WalletSkeleton";
import CashflowIntelligenceSkeleton from "@/components/skeletons/CashflowIntelligenceSkeleton";
import ConnectedAppsSkeleton from "@/components/skeletons/ConnectedAppsSkeleton";
import WorkspaceSkeleton from "@/components/skeletons/WorkspaceSkeleton";
import BankConnectionsSkeleton from "@/components/skeletons/BankConnectionsSkeleton";
import InvoiceSkeleton from "@/components/skeletons/InvoiceSkeleton";
import ReceiptsSkeleton from "@/components/skeletons/ReceiptsSkeleton";
import ReportsSkeleton from "@/components/skeletons/ReportsSkeleton";
import ReconciliationSkeleton from "@/components/skeletons/ReconciliationSkeleton";
import EmployeesSkeleton from "@/components/skeletons/EmployeesSkeleton";
import PayrollSkeleton from "@/components/skeletons/PayrollSkeleton";
import TaxToolSkeleton from "@/components/skeletons/TaxToolSkeleton";
import MarketplaceSkeleton from "@/components/skeletons/MarketplaceSkeleton";
import SuperSheetSkeleton from "@/components/skeletons/SuperSheetSkeleton";
import RatiosSkeleton from "@/components/skeletons/RatiosSkeleton";
import ModellingListSkeleton from "@/components/skeletons/ModellingListSkeleton";

function DefaultSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <SkeletonMetrics count={4} />

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Route-aware page skeleton.
 *
 * When `overridePath` is provided (e.g. from the NavigationContext's
 * `pendingPath`), the skeleton matches the **destination** page's layout
 * instead of the current page.
 */
export default function PageSkeleton({ overridePath }: { overridePath?: string | null } = {}) {
  const pathname = usePathname();
  const resolvedPath = overridePath || pathname;

  // --- Personal mode ----------------------------------------------------------
  if (resolvedPath?.startsWith("/personal/dashboard")) {
    return <InvestmentDashboardSkeleton />;
  }
  if (resolvedPath?.startsWith("/personal/apps")) {
    return <ConnectedAppsSkeleton />;
  }
  if (resolvedPath === "/personal") {
    return <ChatSkeleton />;
  }

  // --- Tax --------------------------------------------------------------------
  if (resolvedPath?.startsWith("/tax/workspace")) {
    return <TaxWorkspaceSkeleton />;
  }
  if (resolvedPath?.startsWith("/tax/computation")) {
    return <TaxWorkspaceSkeleton />;
  }
  if (resolvedPath?.startsWith("/tax/adjustments")) {
    return <TaxWorkspaceSkeleton />;
  }
  if (resolvedPath?.startsWith("/tax/settings")) {
    return <TaxWorkspaceSkeleton />;
  }
  if (resolvedPath?.startsWith("/tax/calendar")) {
    return <TaxWorkspaceSkeleton />;
  }
  if (resolvedPath?.startsWith("/tax/file-taxes")) {
    return <TaxWorkspaceSkeleton />;
  }
  if (resolvedPath?.startsWith("/tax/payments")) {
    return <TaxWorkspaceSkeleton />;
  }
  if (resolvedPath?.startsWith("/tax/returns")) {
    return <TaxWorkspaceSkeleton />;
  }
  if (resolvedPath?.startsWith("/tax/transactions")) {
    return <TaxWorkspaceSkeleton />;
  }
  if (resolvedPath?.startsWith("/tax-tools")) {
    return <TaxToolSkeleton />;
  }

  // --- Accounting (specific sub-pages before the catch-all) -------------------
  if (resolvedPath?.startsWith("/accounting/projections/modelling")) {
    return <ModellingListSkeleton />;
  }
  if (resolvedPath?.startsWith("/accounting/projections")) {
    return <ProjectionsSkeleton />;
  }
  if (resolvedPath?.startsWith("/accounting/workspace")) {
    return <WorkspaceSkeleton />;
  }
  if (resolvedPath?.startsWith("/accounting/banks")) {
    return <BankConnectionsSkeleton />;
  }
  if (resolvedPath?.startsWith("/accounting/invoices")) {
    return <InvoiceSkeleton />;
  }
  if (resolvedPath?.startsWith("/accounting/receipts")) {
    return <ReceiptsSkeleton />;
  }
  if (resolvedPath?.startsWith("/accounting/reports")) {
    return <ReportsSkeleton />;
  }
  if (resolvedPath?.startsWith("/accounting/reconciliation")) {
    return <ReconciliationSkeleton />;
  }
  if (resolvedPath?.startsWith("/accounting/employees")) {
    return <EmployeesSkeleton />;
  }
  if (resolvedPath?.startsWith("/accounting/payroll")) {
    return <PayrollSkeleton />;
  }
  if (resolvedPath?.startsWith("/accounting")) {
    return <ChatSkeleton />;
  }

  // --- Dashboard --------------------------------------------------------------
  if (resolvedPath?.startsWith("/dashboard")) {
    return <DashboardSkeleton />;
  }

  // --- Cashflow Intelligence --------------------------------------------------
  if (resolvedPath?.startsWith("/cashflow-intelligence/ratios")) {
    return <RatiosSkeleton />;
  }
  if (resolvedPath?.startsWith("/cashflow-intelligence/chat")) {
    return <ChatSkeleton />;
  }
  if (resolvedPath?.startsWith("/cashflow-intelligence")) {
    return <CashflowIntelligenceSkeleton />;
  }

  // --- Wallet -----------------------------------------------------------------
  if (resolvedPath?.startsWith("/wallet")) {
    return <WalletSkeleton />;
  }

  // --- SuperSheet -------------------------------------------------------------
  if (resolvedPath?.startsWith("/supersheet")) {
    return <SuperSheetSkeleton />;
  }

  // --- Marketplace ------------------------------------------------------------
  if (resolvedPath?.startsWith("/marketplace")) {
    return <MarketplaceSkeleton />;
  }

  // --- Fallback ---------------------------------------------------------------
  return <DefaultSkeleton />;
}
