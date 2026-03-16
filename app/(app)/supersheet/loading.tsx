export default function SuperSheetLoading() {
    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#0a0a0a]">
            {/* Header skeleton */}
            <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="space-y-2">
                    <div className="w-40 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
            </div>

            {/* Toolbar skeleton */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-700">
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ))}
            </div>

            {/* Formula bar skeleton */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-700">
                <div className="w-16 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="flex-1 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>

            {/* Grid skeleton */}
            <div className="flex-1 p-4">
                <div className="w-full h-full bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="grid grid-cols-8 gap-px bg-gray-200 dark:bg-gray-700">
                        {[...Array(64)].map((_, i) => (
                            <div key={i} className="h-8 bg-gray-50 dark:bg-[#252525]" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Sheet tabs skeleton */}
            <div className="flex items-center gap-1 px-2 py-2 bg-gray-100 dark:bg-[#151515] border-t border-gray-200 dark:border-gray-700">
                <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
        </div>
    );
}
