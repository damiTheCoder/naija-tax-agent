"use client";

import { usePathname } from "next/navigation";
import HeaderNav from "@/components/HeaderNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      {!isLanding && <HeaderNav />}

      <main className={isLanding ? "flex-1" : "flex-1 py-8 px-4"}>
        {isLanding ? (
          children
        ) : (
          <div className="max-w-4xl mx-auto w-full">{children}</div>
        )}
      </main>

      {!isLanding && (
        <footer className="py-8 px-6 text-center text-sm text-[#666666]">
          <p>© 2024 Taxy · Smart Nigerian Tax Manager</p>
        </footer>
      )}
    </div>
  );
}

