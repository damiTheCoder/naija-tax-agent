"use client";

import { useEffect, useState, ReactNode } from "react";

/**
 * ScrollNav — thin client wrapper that toggles the "nav-scrolled" class
 * on the <nav> element based on scroll position. Keeps the rest of the
 * landing page as a server component.
 */
export function ScrollNav({ children }: { children: ReactNode }) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <nav className={`nav-modern ${scrolled ? "nav-scrolled" : ""}`}>
            {children}
        </nav>
    );
}

/**
 * ScrollAnimator — sets up an IntersectionObserver to add "animate-in"
 * class to elements with scroll animation CSS classes.
 */
export function ScrollAnimator({ children }: { children: ReactNode }) {
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("animate-in");
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: "0px 0px -50px 0px",
            }
        );

        const animatedElements = document.querySelectorAll(
            ".scroll-animate, .scroll-drop-in, .scroll-fade-up, .scroll-fade-in, .scroll-slide-left, .scroll-slide-right"
        );
        animatedElements.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, []);

    return <>{children}</>;
}
