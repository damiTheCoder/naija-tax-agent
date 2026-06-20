"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (nextTheme: Theme) => void;
    mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_STORAGE_KEY = "theme";
const THEME_CHANGE_EVENT = "app-theme-change";
const LIGHT_THEME_BACKGROUND = "#fdfcfb";
const noopSubscribe = () => () => { };
const getServerTheme = () => "light" as const;

function readStoredTheme(): Theme | null {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    return stored === "dark" || stored === "light" ? stored : null;
}

function readSystemTheme(): Theme {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeToStoredTheme(onStoreChange: () => void) {
    if (typeof window === "undefined") return () => { };

    const handleStorage = (event: StorageEvent) => {
        if (event.key && event.key !== THEME_STORAGE_KEY) return;
        onStoreChange();
    };

    const handleThemeChange = () => onStoreChange();

    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);

    return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
}

function subscribeToSystemTheme(onStoreChange: () => void) {
    if (typeof window === "undefined") return () => { };

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => onStoreChange();

    if (typeof media.addEventListener === "function") {
        media.addEventListener("change", handleChange);
        return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Force single light theme for the whole app.
    const storedTheme = null;
    const systemTheme = "light" as const;
    const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
    const theme: Theme = "light";

    // Apply theme class to document
    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        // Ensure the `dark` class is never present and force light appearance.
        root.classList.remove("dark");
        root.style.colorScheme = "light";
        body.style.backgroundColor = LIGHT_THEME_BACKGROUND;
        body.style.color = "#0a0a0a";

        document
            .querySelectorAll('meta[name="theme-color"]')
            .forEach((meta) => meta.setAttribute("content", LIGHT_THEME_BACKGROUND));
    }, [theme]);

    const toggleTheme = () => {
        // Theme switching disabled — keep no-op to preserve callers.
        return;
    };

    const setTheme = (nextTheme: Theme) => {
        // Disabled: do not change theme; keep function for compatibility.
        return;
    };

    // Render children always, but with suppressed hydration warning div wrapper
    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, mounted }}>
            <div suppressHydrationWarning>
                {children}
            </div>
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
