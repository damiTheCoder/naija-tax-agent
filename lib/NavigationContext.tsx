"use client";

import { createContext, useContext, useState, useTransition, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

interface NavigationContextType {
    isNavigating: boolean;
    navigateTo: (href: string) => void;
    pendingPath?: string | null;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
    const [pendingPath, setPendingPath] = useState<string | null>(null);
    const [, startTransition] = useTransition();
    const pathname = usePathname();
    const router = useRouter();
    const isNavigating = Boolean(pendingPath && pendingPath !== pathname);

    const navigateTo = (href: string) => {
        if (href === pathname) return;

        setPendingPath(href);
        startTransition(() => {
            router.push(href);
        });
    };

    return (
        <NavigationContext.Provider value={{ isNavigating, navigateTo, pendingPath }}>
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation() {
    const context = useContext(NavigationContext);
    if (context === undefined) {
        throw new Error("useNavigation must be used within a NavigationProvider");
    }
    return context;
}
