"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

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
            <Image src="/logo.png" alt="Taxy Logo" width={40} height={40} className="logo-image" />
            <span className="logo-text">Taxy</span>
          </Link>
          <div className="nav-links">
            {navLinks.map((link) => (
              <Link key={link.label} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </div>
          <Link href="/main" className="nav-cta">
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
              <Link href="/main" className="hero-cta">
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
                    <Image src="/logo.png" alt="Profile" width={40} height={40} className="rounded-full" />
                  </div>
                  <div className="profile-info">
                    <div className="profile-name">Taxy AI</div>
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
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              New: AI-powered bank reconciliation now live
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Over 10,000 transactions processed this month
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Taxy partners with major Nigerian banks
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              Enterprise features coming Q1 2025
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Rated #1 AI Accounting Platform for SMEs
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Bank-grade security & encryption
            </span>
            {/* Duplicate for seamless loop */}
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              New: AI-powered bank reconciliation now live
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Over 10,000 transactions processed this month
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Taxy partners with major Nigerian banks
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              Enterprise features coming Q1 2025
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Rated #1 AI Accounting Platform for SMEs
            </span>
            <span className="ticker-item">
              <svg className="ticker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Bank-grade security & encryption
            </span>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section animate-on-scroll" id="about">
        <div className="about-label">About Taxy</div>
        <p className="about-text">
          At Taxy, we don&apos;t just track numbers — we make them make sense. Since 2024,
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
              {icons.sparkle}
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

      {/* Problem Section */}
      <section className="problem-section animate-on-scroll" id="problem">
        <div className="section-header">
          <span className="section-label">The Problem</span>
          <h2 className="section-title">Most small businesses are flying blind.</h2>
          <p className="section-subtitle">Accounting tools are built for accountants — not for business owners.</p>
        </div>
        <div className="problem-grid">
          {problemPoints.map((point, index) => (
            <div key={index} className="problem-card">
              <span className="problem-icon">✕</span>
              <p>{point}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solution Section */}
      <section className="solution-section animate-on-scroll" id="solution">
        <div className="section-header">
          <span className="section-label">The Solution</span>
          <h2 className="section-title">We turned accounting into a conversation.</h2>
          <p className="section-subtitle">
            Instead of dashboards you don&apos;t understand, spreadsheets you avoid, or reports you never read — you just ask the AI.
          </p>
        </div>
        <div className="prompts-grid">
          {samplePrompts.map((prompt, index) => (
            <div key={index} className="prompt-card">
              <span className="prompt-quote">&ldquo;</span>
              <p>{prompt}</p>
            </div>
          ))}
        </div>
        <p className="solution-tagline">The AI understands your books — and explains them like a finance partner would.</p>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section animate-on-scroll" id="how-it-works">
        <div className="section-header">
          <span className="section-label">How It Works</span>
          <h2 className="section-title">Simple. Secure. Real-time.</h2>
        </div>
        <div className="steps-grid">
          {howItWorks.map((step) => (
            <div key={step.step} className="step-card">
              <div className="step-number">{step.step}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-description">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section animate-on-scroll" id="features">
        <div className="section-header">
          <span className="section-label">Core Features</span>
          <h2 className="section-title">Everything you need to know your numbers.</h2>
        </div>
        <div className="features-grid">
          {coreFeatures.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{getFeatureIcon(feature.icon)}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Section */}
      <section className="comparison-section animate-on-scroll">
        <div className="section-header">
          <span className="section-label">Why This Is Revolutionary</span>
          <h2 className="section-title">From burden to business advantage.</h2>
        </div>
        <div className="comparison-grid">
          <div className="comparison-card comparison-old">
            <h3>Traditional Accounting Software</h3>
            <ul>
              <li>Static dashboards</li>
              <li>Complex setup</li>
              <li>Requires accounting knowledge</li>
              <li>Reactive (after problems happen)</li>
            </ul>
          </div>
          <div className="comparison-card comparison-new">
            <h3>This Platform</h3>
            <ul>
              <li>Conversational</li>
              <li>Proactive</li>
              <li>Built for clarity</li>
              <li>Designed for decision-making</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Who It's For Section */}
      <section className="audience-section animate-on-scroll">
        <div className="section-header">
          <span className="section-label">Who It&apos;s For</span>
          <h2 className="section-title">Built for operators, not accountants.</h2>
        </div>
        <div className="audience-grid">
          {whoItsFor.map((item, index) => (
            <div key={index} className="audience-item">
              <span className="audience-check">{icons.check}</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Outcome Section */}
      <section className="outcome-section animate-scale">
        <div className="outcome-content">
          <h2>Know your numbers.<br />Control your business.<br />Make decisions with confidence.</h2>
          <div className="outcome-points">
            <p>No more blind testing.</p>
            <p>No more late surprises.</p>
            <p>No more confusion.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section animate-fade-up" id="contact">
        <div className="cta-card">
          <h2>Your AI Finance Partner Starts Here</h2>
          <p>Join the next generation of businesses running on clarity — not guesswork.</p>
          <div className="cta-buttons">
            <Link href="/main" className="cta-primary">
              Get Early Access
            </Link>
            <Link href="#how-it-works" className="cta-secondary">
              See How It Works <span>↗</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Image src="/logo.png" alt="Taxy Logo" width={36} height={36} className="logo-image" />
            <span className="logo-text">Taxy</span>
          </div>
          <p className="footer-tagline">AI Accounting for Real Businesses</p>
          <div className="footer-links">
            <Link href="#features">Features</Link>
            <Link href="/main">Get Started</Link>
            <Link href="#how-it-works">How It Works</Link>
          </div>
          <p className="footer-copy">© 2024 Taxy. Built for Nigerian businesses.</p>
        </div>
      </footer>
    </div>
  );
}
