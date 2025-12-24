"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { APP_LOGO_ALT, APP_LOGO_SRC } from "@/lib/constants";

const navLinks = [
  { label: "Problem", href: "#problem" },
  { label: "Solution", href: "#solution" },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
];

const trustStrip = [
  "Bank-connected",
  "Audit-ready",
  "SME-focused",
  "Built for real businesses",
];

const problemPoints = [
  "Transactions sit scattered across bank apps",
  "Accounting is delayed, confusing, or ignored",
  "Financial statements are prepared too late — if at all",
  "Business owners don't know how much they made",
  "No visibility into where money is leaking",
  "Can't tell if they're growing or just surviving",
];

const samplePrompts = [
  "How much profit did I make last month?",
  "Why did expenses increase in March?",
  "Prepare my financial statements.",
  "Add this expense manually.",
  "What's hurting my cash flow?",
];

const howItWorks = [
  {
    step: "1",
    title: "Connect Your Bank",
    description: "Securely link your business bank accounts. The AI automatically pulls and organizes transactions.",
  },
  {
    step: "2",
    title: "Talk to Your Books",
    description: "Chat with your accounting records: Categorize transactions, add manual entries, ask financial questions.",
  },
  {
    step: "3",
    title: "AI-Prepared Accounting",
    description: "The AI prepares your books, structures transactions properly, and keeps your records clean and consistent.",
  },
  {
    step: "4",
    title: "Audit & Compliance Ready",
    description: "Upload audit documents or past financials. The AI reconstructs historical data and aligns records.",
  },
];

const coreFeatures = [
  {
    icon: "chat",
    title: "AI Accounting Chat",
    description: "Your books, accessible through natural language. No accounting knowledge required.",
  },
  {
    icon: "bank",
    title: "Automatic Transaction Prep",
    description: "Smart transaction categorization, continuous reconciliation, reduced manual errors.",
  },
  {
    icon: "edit",
    title: "Manual Entries via Chat",
    description: "Forgot an expense? Just tell the AI — it records it correctly.",
  },
  {
    icon: "chart",
    title: "Financial Statements on Demand",
    description: "Profit & Loss, Balance Sheet, Cash Flow — generated when you need them.",
  },
  {
    icon: "search",
    title: "Audit & Historical Reconstruction",
    description: "Upload audited financials. The AI recalculates and aligns past data accurately.",
  },
  {
    icon: "compass",
    title: "Business Direction & Insights",
    description: "The AI guides decisions: where money is going, what's working, what to focus on next.",
  },
];

const whoItsFor = [
  "Small business owners",
  "Freelancers & agencies",
  "Growing SMEs",
  "Founders without finance teams",
  "Businesses tired of guessing",
];

// SVG Icons
const icons = {
  chatgpt: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4066-.6898zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  ),
  sparkle: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  ),
  chat: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  ),
  bank: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
    </svg>
  ),
  bankLarge: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
    </svg>
  ),
  edit: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  ),
  chart: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  ),
  search: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  ),
  compass: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
  ),
  arrowRight: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
    </svg>
  ),
  check: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  ),
  trendUp: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
    </svg>
  ),
};

const getFeatureIcon = (iconName: string) => {
  switch (iconName) {
    case "chat": return icons.chat;
    case "bank": return icons.bank;
    case "edit": return icons.edit;
    case "chart": return icons.chart;
    case "search": return icons.search;
    case "compass": return icons.compass;
    default: return icons.sparkle;
  }
};

export default function LandingPage() {
  // Scroll animation effect
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-visible');
        }
      });
    }, observerOptions);

    // Observe all elements with animation classes
    const animatedElements = document.querySelectorAll('.animate-on-scroll, .animate-fade-up, .animate-fade-left, .animate-fade-right, .animate-scale');
    animatedElements.forEach((el) => observer.observe(el));

    return () => {
      animatedElements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  return (
    <div className="landing-container">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-content">
          <Link href="/" className="nav-logo">
            <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} width={40} height={40} className="logo-image" />
            <span className="logo-text">Insight</span>
          </Link>
          <div className="nav-links">
            {navLinks.map((link) => (
              <Link key={link.label} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </div>
          <Link href="/accounting" className="nav-cta">
            Get Early Access {icons.arrowRight}
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section animate-fade-up animate-visible">
        <div className="hero-card-main">
          <div className="hero-content">
            <p className="hero-eyebrow">Accounting, Explained by AI. In Plain English.</p>
            <h1 className="hero-title">
              Your business books, accessible
              <br />
              through a simple chat.
            </h1>
            <p className="hero-subtitle">
              Connect your bank. Talk to your accounting records.
              <br />
              Let AI prepare, audit, and explain your finances — in real time.
            </p>
            <div className="hero-buttons">
              <Link href="/accounting" className="hero-cta">
                Get Early Access
              </Link>
              <Link href="#how-it-works" className="hero-cta-secondary">
                See How It Works {icons.arrowRight}
              </Link>
            </div>
            <div className="hero-avatars">
              <div className="avatar-group">
                <div className="avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/j1.jpeg" alt="User 1" className="avatar-img" />
                </div>
                <div className="avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/j2.jpeg" alt="User 2" className="avatar-img" />
                </div>
                <div className="avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/j3.jpeg" alt="User 3" className="avatar-img" />
                </div>
              </div>
              <span className="avatar-text">
                Trusted by SMEs.
                <br />
                Built for real businesses.
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-visual-container">
              {/* Decorative circles */}
              <div className="hero-circle hero-circle-green"></div>
              <div className="hero-circle hero-circle-blue"></div>

              {/* Main image card */}
              <div className="hero-image-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=500&fit=crop&crop=face"
                  alt="Business professional"
                  className="hero-person-img"
                />

                {/* Rating badge */}
                <div className="hero-badge hero-badge-rating">
                  <div className="badge-icons">▲▲▲▲</div>
                  <div className="badge-number">95+</div>
                  <div className="badge-label">RATING</div>
                </div>

                {/* Profile card */}
                <div className="hero-badge hero-badge-profile">
                  <div className="profile-avatar">
                    <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} width={40} height={40} className="rounded-full" />
                  </div>
                  <div className="profile-info">
                    <div className="profile-name">Insight AI</div>
                    <div className="profile-role">Your Accountant</div>
                  </div>
                  <div className="profile-actions">
                    {icons.trendUp}
                    <span className="star-icon">★</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="trust-strip">
        {trustStrip.map((item) => (
          <div key={item} className="trust-item">
            <span className="trust-check">{icons.check}</span>
            <span>{item}</span>
          </div>
        ))}
      </section>

      {/* News Ticker */}
      <section className="news-ticker">
        <div className="ticker-wrapper">
          <div className="ticker-content">
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" /></svg>
              New: AI-powered bank reconciliation now live
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Over 10,000 transactions processed this month
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Insight partners with major Nigerian banks
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
              Enterprise features coming Q1 2025
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              Rated #1 AI Accounting Platform for SMEs
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Bank-grade security & encryption
            </span>
            {/* Duplicate for seamless loop */}
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" /></svg>
              New: AI-powered bank reconciliation now live
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Over 10,000 transactions processed this month
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Insight partners with major Nigerian banks
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
              Enterprise features coming Q1 2025
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              Rated #1 AI Accounting Platform for SMEs
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Bank-grade security & encryption
            </span>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section animate-on-scroll" id="about">
        <div className="about-label">About Insight</div>
        <p className="about-text">
          At Insight, we don&apos;t just track numbers — we make them make sense. Since 2024,
          our platform has been a home for business owners of all types, from eager
          freelancers to seasoned enterprises.
        </p>
      </section>

      {/* Bento Grid Features */}
      <section className="bento-section animate-on-scroll">
        <div className="bento-grid">
          {/* Feature 1 - Black Card */}
          <div className="bento-card bento-dark">
            <div className="bento-icon-wrapper">
              {icons.chatgpt}
            </div>
            <h3 className="bento-title">AI Accounting Chat</h3>
            <p className="bento-desc">
              with intelligent analysis & real-time guidance —
              <br />
              get answers <span className="highlight">in seconds,</span>
              <br />
              not hours.
            </p>
            <div className="bento-toggle">
              <div className="toggle-track">
                <div className="toggle-thumb"></div>
              </div>
              <span>Smart Mode</span>
            </div>
          </div>

          {/* Feature 2 - White Card with Visual */}
          <div className="bento-card bento-white bento-visual">
            <div className="visual-svg">{icons.bankLarge}</div>
            <div className="bento-label">Bank-Connected Accounting</div>
            {/* Decorative gradient circles */}
            <div className="bento-gradient-circle circle-1"></div>
            <div className="bento-gradient-circle circle-2"></div>
            <div className="bento-gradient-circle circle-3"></div>
          </div>

          {/* Feature 3 - Stats Card */}
          <div className="bento-card bento-stats">
            <div className="stats-number">100+</div>
            <div className="stats-label-big">Features</div>
            <p className="stats-desc">
              Comprehensive coverage of accounting, statements, and business insights.
            </p>
            <div className="stats-levels">
              <div className="level-item">
                <span className="level-name">Transactions</span>
                <div className="level-dots">
                  {[...Array(10)].map((_, i) => (
                    <span key={i} className="dot filled"></span>
                  ))}
                </div>
                <span className="level-count">Auto</span>
              </div>
              <div className="level-item">
                <span className="level-name">Statements</span>
                <div className="level-dots">
                  {[...Array(8)].map((_, i) => (
                    <span key={i} className="dot filled"></span>
                  ))}
                  {[...Array(2)].map((_, i) => (
                    <span key={`empty-${i}`} className="dot"></span>
                  ))}
                </div>
                <span className="level-count">P&L</span>
              </div>
              <div className="level-item">
                <span className="level-name">Insights</span>
                <div className="level-dots">
                  {[...Array(6)].map((_, i) => (
                    <span key={i} className="dot filled"></span>
                  ))}
                  {[...Array(4)].map((_, i) => (
                    <span key={`empty2-${i}`} className="dot"></span>
                  ))}
                </div>
                <span className="level-count">AI</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section - Dramatic Visual Storytelling */}
      <section className="problem-section-new animate-on-scroll" id="problem">
        <div className="problem-container">
          <div className="problem-content">
            <span className="problem-eyebrow">THE PROBLEM</span>
            <h2 className="problem-headline">
              Most small businesses are <span className="problem-highlight">flying blind.</span>
            </h2>
            <p className="problem-subtext">
              Accounting tools are built for accountants — not for business owners who just want to understand their numbers.
            </p>
            <div className="problem-points-grid">
              {problemPoints.map((point, index) => (
                <div key={index} className="problem-point-card">
                  <div className="problem-point-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p>{point}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="problem-visual">
            <div className="problem-image-wrapper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=700&fit=crop"
                alt="Business owner stressed over finances"
                className="problem-main-image"
              />
              <div className="problem-overlay-card">
                <div className="problem-stat">68%</div>
                <p>of SMEs don&apos;t know their real profit margins</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section - AI Chat Showcase with Glassmorphism */}
      <section className="solution-section-new animate-on-scroll" id="solution">
        <div className="solution-container">
          <div className="solution-header">
            <span className="solution-eyebrow">THE SOLUTION</span>
            <h2 className="solution-headline">
              We turned accounting into <span className="solution-highlight">a conversation.</span>
            </h2>
            <p className="solution-subtext">
              Instead of dashboards you don&apos;t understand, spreadsheets you avoid, or reports you never read — you just ask the AI.
            </p>
          </div>

          <div className="solution-showcase">
            <div className="chat-mockup">
              <div className="chat-header">
                <div className="chat-header-dot"></div>
                <div className="chat-header-dot"></div>
                <div className="chat-header-dot"></div>
                <span>Insight AI Assistant</span>
              </div>
              <div className="chat-messages">
                <div className="chat-message user">
                  <p>How much profit did I make last month?</p>
                </div>
                <div className="chat-message ai">
                  <div className="ai-avatar">
                    <Image src={APP_LOGO_SRC} alt="AI" width={24} height={24} />
                  </div>
                  <div className="ai-content">
                    <p>Based on your March transactions, your net profit was <strong>₦847,500</strong> — up 23% from February.</p>
                    <div className="ai-chart-preview">
                      <div className="mini-bar" style={{ height: '40%' }}></div>
                      <div className="mini-bar" style={{ height: '55%' }}></div>
                      <div className="mini-bar" style={{ height: '70%' }}></div>
                      <div className="mini-bar" style={{ height: '62%' }}></div>
                      <div className="mini-bar active" style={{ height: '85%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="prompts-showcase">
              <h3>Try asking things like:</h3>
              <div className="prompt-bubbles">
                {samplePrompts.map((prompt, index) => (
                  <div key={index} className="prompt-bubble">
                    <span className="prompt-icon">&ldquo;</span>
                    <p>{prompt}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="solution-tagline-new">
            The AI understands your books — and explains them like a finance partner would.
          </p>
        </div>
      </section>

      {/* How It Works - Interactive Timeline with Illustrations */}
      <section className="hiw-section animate-on-scroll" id="how-it-works">
        <div className="hiw-container">
          <div className="hiw-header">
            <span className="hiw-eyebrow">HOW IT WORKS</span>
            <h2 className="hiw-headline">Simple. Secure. Real-time.</h2>
            <p className="hiw-subtext">Get started in minutes, not months.</p>
          </div>

          <div className="hiw-timeline">
            {howItWorks.map((step, index) => (
              <div key={step.step} className="hiw-step">
                <div className="hiw-step-visual">
                  <div className="hiw-step-number">{step.step}</div>
                  <div className="hiw-step-icon">
                    {index === 0 && icons.bank}
                    {index === 1 && icons.chat}
                    {index === 2 && icons.sparkle}
                    {index === 3 && icons.check}
                  </div>
                </div>
                <div className="hiw-step-content">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
                {index < howItWorks.length - 1 && <div className="hiw-connector"></div>}
              </div>
            ))}
          </div>

          <div className="hiw-visual">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=500&fit=crop"
              alt="Team working on laptops"
              className="hiw-image"
            />
            <div className="hiw-floating-card">
              <div className="hiw-card-icon">✓</div>
              <div className="hiw-card-text">
                <strong>Bank synced</strong>
                <span>247 transactions imported</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Premium Bento Grid */}
      <section className="features-section-new animate-on-scroll" id="features">
        <div className="features-container">
          <div className="features-header">
            <span className="features-eyebrow">CORE FEATURES</span>
            <h2 className="features-headline">Everything you need to know your numbers.</h2>
          </div>

          <div className="features-bento">
            {coreFeatures.map((feature, index) => (
              <div key={index} className={`feature-bento-card ${index === 0 ? 'feature-large' : ''}`}>
                <div className="feature-bento-icon">{getFeatureIcon(feature.icon)}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                {index === 0 && (
                  <div className="feature-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=200&fit=crop"
                      alt="Dashboard preview"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section - Split Screen Visual */}
      <section className="comparison-section-new animate-on-scroll">
        <div className="comparison-container">
          <div className="comparison-header">
            <span className="comparison-eyebrow">WHY THIS IS REVOLUTIONARY</span>
            <h2 className="comparison-headline">From burden to business advantage.</h2>
          </div>

          <div className="comparison-split">
            <div className="comparison-side comparison-old-new">
              <div className="comparison-side-header">
                <span className="comparison-badge old">Before</span>
                <h3>Traditional Accounting Software</h3>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=500&h=300&fit=crop&sat=-100"
                alt="Traditional accounting"
                className="comparison-image grayscale"
              />
              <ul className="comparison-list">
                <li><span className="x-mark">✕</span> Static dashboards</li>
                <li><span className="x-mark">✕</span> Complex setup</li>
                <li><span className="x-mark">✕</span> Requires accounting knowledge</li>
                <li><span className="x-mark">✕</span> Reactive (after problems happen)</li>
              </ul>
            </div>

            <div className="comparison-divider">
              <span>VS</span>
            </div>

            <div className="comparison-side comparison-new-side">
              <div className="comparison-side-header">
                <span className="comparison-badge new">After</span>
                <h3>Insight AI Platform</h3>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&h=300&fit=crop"
                alt="Modern AI accounting"
                className="comparison-image"
              />
              <ul className="comparison-list">
                <li><span className="check-mark">✓</span> Conversational interface</li>
                <li><span className="check-mark">✓</span> Proactive insights</li>
                <li><span className="check-mark">✓</span> Built for clarity</li>
                <li><span className="check-mark">✓</span> Designed for decision-making</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Audience Section - People Gallery */}
      <section className="audience-section-new animate-on-scroll">
        <div className="audience-container">
          <div className="audience-header">
            <span className="audience-eyebrow">WHO IT&apos;S FOR</span>
            <h2 className="audience-headline">Built for operators, not accountants.</h2>
          </div>

          <div className="audience-gallery">
            <div className="audience-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face" alt="Business owner" />
              <span>Small business owners</span>
            </div>
            <div className="audience-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face" alt="Freelancer" />
              <span>Freelancers & agencies</span>
            </div>
            <div className="audience-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face" alt="SME founder" />
              <span>Growing SMEs</span>
            </div>
            <div className="audience-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face" alt="Founder" />
              <span>Founders without finance teams</span>
            </div>
            <div className="audience-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face" alt="Entrepreneur" />
              <span>Businesses tired of guessing</span>
            </div>
          </div>
        </div>
      </section>

      {/* Outcome Section - Inspiring Full-Width Banner */}
      <section className="outcome-section-new animate-scale">
        <div className="outcome-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1400&h=600&fit=crop"
            alt="Team celebrating success"
          />
          <div className="outcome-overlay"></div>
        </div>
        <div className="outcome-content-new">
          <h2>
            Know your numbers.<br />
            Control your business.<br />
            Make decisions with confidence.
          </h2>
          <div className="outcome-stats">
            <div className="outcome-stat">
              <span className="stat-number">95%</span>
              <span className="stat-label">Faster reporting</span>
            </div>
            <div className="outcome-stat">
              <span className="stat-number">3x</span>
              <span className="stat-label">Better visibility</span>
            </div>
            <div className="outcome-stat">
              <span className="stat-number">0</span>
              <span className="stat-label">Accounting expertise needed</span>
            </div>
          </div>
          <div className="outcome-promises">
            <p>✓ No more blind testing</p>
            <p>✓ No more late surprises</p>
            <p>✓ No more confusion</p>
          </div>
        </div>
      </section>

      {/* CTA Section - Premium Conversion Card */}
      <section className="cta-section-new animate-fade-up" id="contact">
        <div className="cta-container">
          <div className="cta-card-new">
            <div className="cta-glow"></div>
            <div className="cta-content-new">
              <h2>Your AI Finance Partner Starts Here</h2>
              <p>Join the next generation of businesses running on clarity — not guesswork.</p>
              <div className="cta-buttons-new">
                <Link href="/accounting" className="cta-primary-new">
                  Get Early Access
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link href="#how-it-works" className="cta-secondary-new">
                  See How It Works
                </Link>
              </div>
              <div className="cta-social-proof">
                <div className="cta-avatars">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/j1.jpeg" alt="User" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/j2.jpeg" alt="User" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/j3.jpeg" alt="User" />
                </div>
                <span>Join 500+ businesses already using Insight</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Modern Multi-Column Layout */}
      <footer className="footer-new">
        <div className="footer-container">
          <div className="footer-main">
            <div className="footer-brand-new">
              <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} width={48} height={48} className="footer-logo" />
              <div>
                <span className="footer-brand-name">Insight</span>
                <p className="footer-brand-tagline">AI Accounting for Real Businesses</p>
              </div>
            </div>

            <div className="footer-links-grid">
              <div className="footer-column">
                <h4>Product</h4>
                <Link href="#features">Features</Link>
                <Link href="#how-it-works">How It Works</Link>
                <Link href="#solution">Solution</Link>
              </div>
              <div className="footer-column">
                <h4>Company</h4>
                <Link href="#">About Us</Link>
                <Link href="#">Careers</Link>
                <Link href="#">Contact</Link>
              </div>
              <div className="footer-column">
                <h4>Legal</h4>
                <Link href="#">Privacy Policy</Link>
                <Link href="#">Terms of Service</Link>
                <Link href="#">Security</Link>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© 2024 Insight. Built for Nigerian businesses. 🇳🇬</p>
            <div className="footer-social">
              <a href="#" aria-label="Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" aria-label="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
