"use client";

import Image from "next/image";
import { APP_LOGO_SRC, APP_LOGO_ALT } from "@/lib/constants";

/**
 * Premium logo loading indicator.
 * Logo breathes (fades in/out and scales slightly) to indicate page transitions.
 */
export default function SkeletonLoader() {
  return (
    <div
      className="flex min-h-[100dvh] w-full items-center justify-center"
      style={{ background: 'var(--app-bg)' }}
    >
      <div className="logo-loader-container" aria-label="Loading" role="status">
        <Image
          src={APP_LOGO_SRC}
          alt={APP_LOGO_ALT}
          width={64}
          height={64}
          className="logo-loader-img"
          priority
        />
      </div>

      <style jsx>{`
        .logo-loader-container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        :global(.logo-loader-img) {
          animation: logoPulse 2s ease-in-out infinite;
          transform-origin: center;
          border-radius: 14px;
        }

        @keyframes logoPulse {
          0%, 100% {
            opacity: 0.15;
            transform: scale(0.92);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}
