"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

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

export function LandingNextButton() {
    const [activeIndex, setActiveIndex] = useState(0);
    const panelCountRef = useRef(0);

    useEffect(() => {
        const panels = Array.from(document.querySelectorAll<HTMLElement>(".landing-panel"));
        if (panels.length === 0) return;
        panelCountRef.current = panels.length;

        panels.forEach((panel, index) => {
            panel.classList.toggle("is-active", index === activeIndex);
        });
    }, [activeIndex]);

    const showNextPanel = () => {
        if (panelCountRef.current === 0) {
            panelCountRef.current = document.querySelectorAll<HTMLElement>(".landing-panel").length;
        }
        if (panelCountRef.current === 0) return;
        if (activeIndex >= panelCountRef.current - 1) {
            window.location.href = "/accounting";
            return;
        }
        setActiveIndex((current) => (current + 1) % panelCountRef.current);
    };

    const showPreviousPanel = () => {
        if (panelCountRef.current === 0) {
            panelCountRef.current = document.querySelectorAll<HTMLElement>(".landing-panel").length;
        }
        if (panelCountRef.current === 0) return;
        setActiveIndex((current) => (current - 1 + panelCountRef.current) % panelCountRef.current);
    };

    return (
        <div className="landing-onboarding-controls" aria-label="Onboarding navigation">
            <button
                type="button"
                className="landing-arrow-button"
                aria-label="Go to previous page"
                onClick={showPreviousPanel}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M19 12H5" />
                    <path d="m12 19-7-7 7-7" />
                </svg>
            </button>
            <button
                type="button"
                className="landing-arrow-button"
                aria-label="Go to next page"
                onClick={showNextPanel}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                </svg>
            </button>
        </div>
    );
}
