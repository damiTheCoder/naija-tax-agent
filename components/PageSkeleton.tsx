"use client";

import SkeletonLoader from "@/components/ui/SkeletonLoader";

/**
 * Page-level loading indicator used as the Suspense fallback in AppShell.
 * Shows a clean 3-dot loader instead of destination-specific skeletons.
 */
export default function PageSkeleton({ overridePath }: { overridePath?: string | null } = {}) {
  return <SkeletonLoader />;
}
