export default function Loading() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="rounded-2xl bg-gray-100 h-24"></div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-xl bg-gray-100 h-32"></div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-gray-100 h-96"></div>
                <div className="rounded-2xl bg-gray-100 h-96"></div>
            </div>
        </div>
    );
}
