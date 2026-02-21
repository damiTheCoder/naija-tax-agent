"use client";

import { usePathname } from "next/navigation";
import { Skeleton, SkeletonMetrics } from "@/components/ui/Skeleton";
import ProjectionsSkeleton from "@/components/skeletons/ProjectionsSkeleton";
import TaxWorkspaceSkeleton from "@/components/skeletons/TaxWorkspaceSkeleton";

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

export default function PageSkeleton({ overridePath }: { overridePath?: string | null } = {}) {
  const pathname = usePathname();
  const resolvedPath = overridePath || pathname;

  if (resolvedPath?.startsWith("/accounting/projections")) {
    return <ProjectionsSkeleton />;
  }

  if (resolvedPath?.startsWith("/tax/workspace")) {
    return <TaxWorkspaceSkeleton />;
  }

  return <DefaultSkeleton />;
}
