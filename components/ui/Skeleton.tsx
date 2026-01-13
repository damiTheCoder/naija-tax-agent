"use client";

import React from "react";

// ============================================
// SKELETON COMPONENTS
// ============================================

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Base skeleton with shimmer animation
 */
export function Skeleton({ className = "", style }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%] rounded ${className}`}
            style={{ animation: "shimmer 1.5s ease-in-out infinite", ...style }}
        />
    );
}

/**
 * Single line skeleton for text
 */
export function SkeletonLine({ width = "100%", height = "1rem" }: { width?: string; height?: string }) {
    return <Skeleton className={`h-4`} style={{ width, height }} />;
}

/**
 * Skeleton for avatar/profile images
 */
export function SkeletonAvatar({ size = 40 }: { size?: number }) {
    return <Skeleton className="rounded-full" style={{ width: size, height: size }} />;
}

/**
 * Skeleton card for loading card content
 */
export function SkeletonCard() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center gap-3">
                <SkeletonAvatar size={40} />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
            <Skeleton className="h-16 w-full" />
            <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
            </div>
        </div>
    );
}

/**
 * Skeleton for list items
 */
export function SkeletonList({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                </div>
            ))}
        </div>
    );
}

/**
 * Skeleton for chat messages
 */
export function SkeletonChat() {
    return (
        <div className="space-y-4">
            {/* User message skeleton */}
            <div className="flex justify-end">
                <div className="max-w-[70%] space-y-2">
                    <Skeleton className="h-12 w-48 rounded-2xl rounded-br-md" />
                </div>
            </div>
            {/* Assistant message skeleton */}
            <div className="flex justify-start">
                <div className="max-w-[70%] space-y-2">
                    <Skeleton className="h-20 w-64 rounded-2xl rounded-bl-md" />
                </div>
            </div>
            {/* Another user message */}
            <div className="flex justify-end">
                <div className="max-w-[70%] space-y-2">
                    <Skeleton className="h-10 w-32 rounded-2xl rounded-br-md" />
                </div>
            </div>
        </div>
    );
}

/**
 * Skeleton for metrics/stats cards
 */
export function SkeletonMetrics({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-3 w-20" />
                </div>
            ))}
        </div>
    );
}

/**
 * Skeleton for table rows
 */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-4 p-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    {Array.from({ length: cols }).map((_, colIndex) => (
                        <Skeleton key={colIndex} className="h-4 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

// Add shimmer keyframes to global styles
// This component adds inline styles for the shimmer effect
export function SkeletonStyles() {
    return (
        <style jsx global>{`
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
    );
}
