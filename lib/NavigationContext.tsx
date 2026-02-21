"use client";

import { createContext, useContext, useEffect, useState, useTransition, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

interface NavigationContextType {
    isNavigating: boolean;
    navigateTo: (href: string) => void;
    pendingPath?: string | null;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
    const [isNavigating, setIsNavigating] = useState(false);
    const [pendingPath, setPendingPath] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const pathname = usePathname();
    const router = useRouter();

    // Reset navigation state when pathname changes (navigation complete)
    useEffect(() => {
        setIsNavigating(false);
        setPendingPath(null);
    }, [pathname]);

    const navigateTo = (href: string) => {
        if (href === pathname) return;

        setIsNavigating(true);
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
