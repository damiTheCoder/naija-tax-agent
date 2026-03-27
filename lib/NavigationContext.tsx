"use client";

import { createContext, useCallback, useContext, useRef, useState, useTransition, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

interface NavigationContextType {
    isNavigating: boolean;
    navigateTo: (href: string) => void;
    prefetchTo: (href: string) => void;
    pendingPath?: string | null;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
    const [pendingPath, setPendingPath] = useState<string | null>(null);
    const [, startTransition] = useTransition();
    const pathname = usePathname();
    const router = useRouter();
    const prefetchedRoutes = useRef<Set<string>>(new Set());
    const resolvedPendingPath = pendingPath === pathname ? null : pendingPath;
    const isNavigating = Boolean(resolvedPendingPath);

    const prefetchTo = useCallback((href: string) => {
        if (!href || href === pathname || prefetchedRoutes.current.has(href)) {
            return;
        }

        prefetchedRoutes.current.add(href);
        try {
            void router.prefetch(href);
        } catch {
            prefetchedRoutes.current.delete(href);
        }
    }, [pathname, router]);

    const navigateTo = useCallback((href: string) => {
        if (href === pathname) return;

        prefetchTo(href);
        setPendingPath(href);
        startTransition(() => {
            router.push(href);
        });
    }, [pathname, prefetchTo, router, startTransition]);

    return (
        <NavigationContext.Provider value={{ isNavigating, navigateTo, prefetchTo, pendingPath: resolvedPendingPath }}>
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
