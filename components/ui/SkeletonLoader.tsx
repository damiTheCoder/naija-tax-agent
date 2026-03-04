"use client";

/**
 * Google-style 4-dot loading indicator.
 * Dots animate in ascending/descending wave order.
 */
export default function SkeletonLoader() {
    return (
        <div
            className="flex items-center justify-center min-h-[60vh]"
            style={{ background: 'var(--app-bg)' }}
        >
            <div className="dot-loader-shell" aria-label="Loading" role="status">
                <span className="dot-loader-dot dot-blue" style={{ animationDelay: '0ms' }} />
                <span className="dot-loader-dot dot-red" style={{ animationDelay: '120ms' }} />
                <span className="dot-loader-dot dot-yellow" style={{ animationDelay: '240ms' }} />
                <span className="dot-loader-dot dot-green" style={{ animationDelay: '360ms' }} />
            </div>

            <style jsx>{`
                .dot-loader-shell {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 14px 26px;
                    border-radius: 9999px;
                    background: #e5e7eb;
                }

                .dot-loader-dot {
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    animation: dotWave 1.1s ease-in-out infinite both;
                    transform: translateY(0);
                }

                .dot-blue {
                    background: #4285f4;
                }

                .dot-red {
                    background: #ea4335;
                }

                .dot-yellow {
                    background: #fbbc05;
                }

                .dot-green {
                    background: #34a853;
                }

                @keyframes dotWave {
                    0%,
                    100% {
                        transform: translateY(0);
                        opacity: 0.9;
                    }

                    25% {
                        transform: translateY(-7px);
                        opacity: 1;
                    }

                    50% {
                        transform: translateY(0);
                        opacity: 0.85;
                    }

                    75% {
                        transform: translateY(7px);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}
