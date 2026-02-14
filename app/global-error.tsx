"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900">Application error</h2>
            <p className="mt-2 text-sm text-gray-600">
              A critical error occurred while loading the app.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
