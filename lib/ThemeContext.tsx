"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (nextTheme: Theme) => void;
    mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);
    const [hasUserPreference, setHasUserPreference] = useState(false);

    // Load theme from localStorage or fall back to system preference
    useEffect(() => {
        const stored = localStorage.getItem("theme") as Theme | null;
        if (stored === "dark" || stored === "light") {
            setThemeState(stored);
            setHasUserPreference(true);
        } else {
            const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            setThemeState(systemPrefersDark ? "dark" : "light");
        }
        setMounted(true);
    }, []);

    // Watch for OS/browser theme changes when user hasn't picked a preference
    useEffect(() => {
        if (!mounted || hasUserPreference) return;
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
            setThemeState(event.matches ? "dark" : "light");
        };
        if (typeof media.addEventListener === "function") {
            media.addEventListener("change", handleChange);
            return () => media.removeEventListener("change", handleChange);
        } else if (typeof media.addListener === "function") {
            media.addListener(handleChange);
            return () => media.removeListener(handleChange);
        }
    }, [mounted, hasUserPreference]);

    // Apply theme class to document
    useEffect(() => {
        if (!mounted) return;

        const root = document.documentElement;
        const body = document.body;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }

        // Keep browser UI/theme controls in sync and prevent Chrome auto-adjust drift.
        root.style.colorScheme = theme;
        body.style.backgroundColor = theme === "dark" ? "#000000" : "#ffffff";
        body.style.color = theme === "dark" ? "#ffffff" : "#0a0a0a";

        document
            .querySelectorAll('meta[name="theme-color"]')
            .forEach((meta) => meta.setAttribute("content", theme === "dark" ? "#000000" : "#ffffff"));
    }, [theme, mounted]);

    // Persist only explicit user preferences
    useEffect(() => {
        if (!mounted) return;
        if (hasUserPreference) {
            localStorage.setItem("theme", theme);
        } else {
            localStorage.removeItem("theme");
        }
    }, [theme, mounted, hasUserPreference]);

    const toggleTheme = () => {
        setHasUserPreference(true);
        setThemeState((prev) => (prev === "light" ? "dark" : "light"));
    };

    const setTheme = (nextTheme: Theme) => {
        setHasUserPreference(true);
        setThemeState(nextTheme);
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
