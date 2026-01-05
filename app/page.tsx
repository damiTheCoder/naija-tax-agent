"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { APP_LOGO_ALT, APP_LOGO_SRC } from "@/lib/constants";

// Hook for scroll animations
function useScrollAnimation() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    const animatedElements = document.querySelectorAll('.scroll-animate, .scroll-drop-in, .scroll-fade-up, .scroll-fade-in, .scroll-slide-left, .scroll-slide-right');
    animatedElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
];

const trustLogos = [
  { name: "500+ Businesses", icon: "users" },
  { name: "Bank-Grade Security", icon: "shield" },
  { name: "FIRS Compliant", icon: "check" },
  { name: "24/7 AI Support", icon: "bot" },
];

const features = [
  {
    icon: "chat",
    title: "AI Accounting Chat",
    description: "Talk to your books in plain English. Ask questions, record transactions, get insights.",
    color: "purple",
  },
  {
    icon: "bank",
    title: "Bank-Connected",
    description: "Automatically sync transactions from your Nigerian bank accounts.",
    color: "green",
  },
  {
    icon: "chart",
    title: "Real-time Reports",
    description: "P&L, Balance Sheet, Cash Flow — generated instantly when you need them.",
    color: "blue",
  },
  {
    icon: "shield",
    title: "Tax Compliance",
    description: "Stay FIRS-compliant with automatic VAT, WHT, and CIT calculations.",
    color: "orange",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Connect Your Bank",
    description: "Securely link your business accounts in under 2 minutes.",
  },
  {
    step: "02",
    title: "Talk to Your Books",
    description: "Ask the AI anything about your finances in plain language.",
  },
  {
    step: "03",
    title: "Get Insights",
    description: "Receive real-time financial reports and actionable insights.",
  },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  // Initialize scroll animations
  useScrollAnimation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="landing-modern">
      {/* ========== NAVIGATION ========== */}
      <nav className={`nav-modern ${scrolled ? "nav-scrolled" : ""}`}>
        <div className="nav-inner">
          <Link href="/" className="nav-brand">
            <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} width={40} height={40} className="nav-logo-img" />
            <span className="nav-brand-text">CashOS</span>
          </Link>

          <div className="nav-links-modern">
            {navLinks.map((link) => (
              <Link key={link.label} href={link.href} className="nav-link-modern">
                {link.label}
              </Link>
            ))}
          </div>

          <Link href="/accounting" className="nav-cta-modern">
            Get Started
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>
      </nav>

      {/* ========== HERO SECTION ========== */}
      <section className="hero-modern hero-centered">
        {/* Background - Grid pattern only */}
        <div className="hero-bg-decorations">
          <div className="hero-grid-pattern"></div>
        </div>

        <div className="hero-content-centered">
          <div className="hero-badge-modern">
            <span className="badge-dot"></span>
            The AI-Powered Cash Operating System for SME's
          </div>

          <h1 className="hero-title-modern">
            Your Business
            <br />
            <span className="hero-title-gradient">Finances,</span>
            <br />
            <span className="hero-title-accent">Simplified.</span>
          </h1>

          <p className="hero-subtitle-modern">
            Know your numbers. Control your cash. Run your business with confidence.
          </p>

          <div className="hero-cta-group">
            <Link href="/accounting" className="cta-primary-modern">
              <span>Start Free Trial</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="#how-it-works" className="cta-secondary-modern">
              Watch Demo
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="hero-trust-strip hero-trust-centered">
            {trustLogos.map((item) => (
              <div key={item.name} className="trust-item-modern">
                <div className="trust-icon-modern">
                  {item.icon === "users" && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  )}
                  {item.icon === "shield" && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  )}
                  {item.icon === "check" && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                  {item.icon === "bot" && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4M8 16h0M16 16h0" /></svg>
                  )}
                </div>
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== PROBLEM SECTION ========== */}
      <section className="problem-section-modern scroll-fade-up" id="problem">
        <div className="section-container">
          <div className="problem-content">
            <span className="section-badge problem-badge">The Problem</span>
            <h2 className="section-title-modern">
              Most small businesses are <span className="problem-highlight">flying blind
                <span className="cursor-indicator">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                    <path d="M13 13l6 6" />
                  </svg>
                </span>
              </span>
            </h2>

            <div className="problem-grid">
              <div className="problem-column">
                <p className="problem-intro">If you&apos;re like most SMEs, you probably:</p>
                <ul className="problem-list">
                  <li>
                    <span className="problem-x">✕</span>
                    Don&apos;t know your real profit
                  </li>
                  <li>
                    <span className="problem-x">✕</span>
                    Don&apos;t know where money is leaking
                  </li>
                  <li>
                    <span className="problem-x">✕</span>
                    Don&apos;t track cash flow properly
                  </li>
                  <li>
                    <span className="problem-x">✕</span>
                    Only discover tax issues when penalties arrive
                  </li>
                </ul>
              </div>

              <div className="problem-column">
                <p className="problem-intro">Accounting today is:</p>
                <ul className="problem-list">
                  <li>
                    <span className="problem-x">✕</span>
                    Manual or delayed
                  </li>
                  <li>
                    <span className="problem-x">✕</span>
                    Expensive
                  </li>
                  <li>
                    <span className="problem-x">✕</span>
                    Built for accountants, not founders
                  </li>
                </ul>
              </div>
            </div>

            <p className="problem-conclusion">
              Finance exists — but <strong>clarity doesn&apos;t.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ========== WHY THIS MATTERS SECTION ========== */}
      <section className="why-matters-section scroll-fade-up" id="why-matters">
        <div className="section-container">
          <div className="why-matters-grid">
            <div className="why-matters-content">
              <span className="section-badge why-matters-badge">Why This Matters</span>
              <h2 className="section-title-modern">
                Businesses don&apos;t fail from lack of effort.
                <br />
                They fail from <span className="title-highlight">lack of visibility.</span>
              </h2>

              <p className="why-matters-intro">Without financial clarity:</p>
            </div>

            {/* Hero Image */}
            <div className="why-matters-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/why-matters-hero.png" alt="CashOS Financial Visibility" />
            </div>
          </div>

          <div className="why-matters-list">
            <div className="why-matters-item">
              <span className="why-matters-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              </span>
              <span>Decisions are instinct-driven</span>
            </div>
            <div className="why-matters-item">
              <span className="why-matters-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </span>
              <span>Taxes are reactive and error-prone</span>
            </div>
            <div className="why-matters-item">
              <span className="why-matters-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              </span>
              <span>Audits become panic events</span>
            </div>
            <div className="why-matters-item">
              <span className="why-matters-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </span>
              <span>Growth becomes guesswork</span>
            </div>
          </div>

          <p className="why-matters-conclusion">
            This isn&apos;t a tooling problem.<br />
            It&apos;s an <strong>economic visibility problem.</strong>
          </p>
        </div>
      </section>

      {/* ========== INTRODUCING CASHOS SECTION ========== */}
      <section className="introducing-section scroll-drop-in" id="introducing">
        <div className="section-container">
          <div className="section-header-modern">
            <span className="section-badge">The Solution</span>
            <h2 className="section-title-modern">
              Introducing
              <br />
              <span className="title-highlight">Cash Operating System</span>
            </h2>
          </div>
        </div>
        {/* Full Width Hero Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cashflow-boosted-hero.png" alt="Cashflow Boosted - Accounting and Tax" className="hero-full-image" />

        {/* CashOS Features List - Horizontal Scroll */}
        <div className="cashos-features-section section-container">
          <h2 className="cashos-brand-title">CashOS</h2>
          <p className="cashos-intro">
            is an AI-powered financial operating system that helps business owners:
          </p>
          <div className="cashos-scroll-container">
            <div className="cashos-scroll-track">
              {/* Card 1: Accounting Records */}
              <div className="cashos-scroll-card">
                <div className="scroll-card-image scroll-card-image-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/feature-accounting-records.jpg" alt="Automatically prepare clean accounting records" />
                </div>
              </div>

              {/* Card 2: Profit & Cash Flow */}
              <div className="cashos-scroll-card">
                <div className="scroll-card-image scroll-card-image-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/feature-profit-cashflow.jpg" alt="Understand profit, costs, and cash flow in real time" />
                </div>
              </div>

              {/* Card 3: Taxes */}
              <div className="cashos-scroll-card">
                <div className="scroll-card-image scroll-card-image-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/feature-taxes.png" alt="Calculate and manage taxes proactively" />
                </div>
              </div>

              {/* Card 4: AI Questions */}
              <div className="cashos-scroll-card">
                <div className="scroll-card-image scroll-card-image-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/feature-questions.png" alt="Ask questions — and get answers in plain language" />
                </div>
              </div>

              {/* Card 5: Savings & Investments */}
              <div className="cashos-scroll-card">
                <div className="scroll-card-image scroll-card-image-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/feature-savings.png" alt="Automate savings, investments, and estimate runway" />
                </div>
              </div>
            </div>
          </div>
          <div className="cashos-tagline">
            <p>No dashboards to learn.</p>
            <p>No spreadsheets to fear.</p>
            <p className="tagline-highlight">Just a simple, conversational finance experience.</p>
          </div>
        </div>
      </section>



      {/* ========== PRICING SECTION ========== */}
      <section className="pricing-section scroll-fade-up" id="pricing">
        <div className="section-container">
          <div className="section-header-modern">
            <span className="section-badge">Pricing</span>
            <h2 className="section-title-modern">
              Simple today. <span className="title-highlight">Powerful tomorrow.</span>
            </h2>
          </div>

          <div className="pricing-grid">
            {/* Starter Plan */}
            <div className="pricing-card">
              <div className="pricing-header">
                <h3 className="pricing-plan-name">Starter</h3>
                <div className="pricing-price">
                  <span className="price-amount">$1.5</span>
                  <span className="price-period">/month</span>
                </div>
              </div>
              <ul className="pricing-features">
                <li>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  Accounting
                </li>
                <li>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  AI finance chat
                </li>
              </ul>
              <Link href="/accounting" className="pricing-cta">Get Started</Link>
            </div>

            {/* Growth Plan */}
            <div className="pricing-card pricing-card-featured">
              <div className="pricing-badge-popular">Most Popular</div>
              <div className="pricing-header">
                <h3 className="pricing-plan-name">Growth</h3>
                <div className="pricing-price">
                  <span className="price-amount">$3.1</span>
                  <span className="price-period">/month</span>
                </div>
              </div>
              <p className="pricing-includes">Everything in Starter, plus:</p>
              <ul className="pricing-features">
                <li>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  Tax calculator
                </li>
                <li>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  Cashflow analysis
                </li>
                <li>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  Automated savings & investments
                </li>
              </ul>
              <Link href="/accounting" className="pricing-cta pricing-cta-featured">Get Started</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA SECTION ========== */}
      <section className="final-cta-section scroll-fade-in">
        <div className="section-container">
          <div className="final-cta-content">
            <h2 className="final-cta-title">
              Stop guessing. <span className="title-highlight">Start knowing.</span>
            </h2>
            <p className="final-cta-subtitle">
              Join thousands of SMEs building financial clarity with CashOS.
            </p>
            <Link href="/accounting" className="final-cta-btn">
              Get Started
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="footer-modern">
        <div className="footer-container-modern">
          <div className="footer-main-modern">
            <div className="footer-brand-modern">
              <Link href="/" className="footer-brand-link">
                <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} width={40} height={40} />
                <span>CashOS</span>
              </Link>
              <p className="footer-tagline">AI Accounting for Nigerian Businesses</p>
            </div>

            <div className="footer-links-modern">
              <div className="footer-col">
                <h4>Product</h4>
                <Link href="#features">Features</Link>
                <Link href="#how-it-works">How It Works</Link>
                <Link href="/accounting">Dashboard</Link>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <Link href="#about">About</Link>
                <Link href="#">Careers</Link>
                <Link href="#">Contact</Link>
              </div>
              <div className="footer-col">
                <h4>Legal</h4>
                <Link href="#">Privacy</Link>
                <Link href="#">Terms</Link>
                <Link href="#">Security</Link>
              </div>
            </div>
          </div>

          <div className="footer-bottom-modern">
            <p>© 2024 CashOS. Built with ❤️ for Nigerian businesses.</p>
            <div className="footer-socials">
              <a href="#" aria-label="Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              <a href="#" aria-label="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
              </a>
              <a href="#" aria-label="Instagram">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
