"use client";

/**
 * Google-style 3-dot loading indicator.
 * Three blue dots that bounce in sequence.
 */
export default function SkeletonLoader() {
    return (
        <div
            className="flex items-center justify-center min-h-[60vh]"
            style={{ background: 'var(--app-bg)' }}
        >
            <div className="flex items-center gap-2">
                <span className="dot-loader-dot" style={{ animationDelay: '0ms' }} />
                <span className="dot-loader-dot" style={{ animationDelay: '160ms' }} />
                <span className="dot-loader-dot" style={{ animationDelay: '320ms' }} />
            </div>

            <style jsx>{`
                .dot-loader-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #2264ff;
                    animation: dotBounce 1.4s ease-in-out infinite both;
                }

                @keyframes dotBounce {
                    0%, 80%, 100% {
                        transform: scale(0.4);
                        opacity: 0.3;
                    }
                    40% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}
