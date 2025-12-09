# NaijaTaxAgent Enterprise Mode Roadmap

This document outlines the planned features and architectural changes required to transform NaijaTaxAgent from a single-user tax calculator into an enterprise-grade platform suitable for Big 4 accounting firms (KPMG, Deloitte, PwC, EY) and large corporate tax departments.

---

## Executive Summary

**Current State**: Single-user web app for freelancers and SMEs  
**Target State**: Multi-tenant SaaS platform with audit compliance, integrations, and advanced tax modules

**Estimated Development Timeline**: 6-9 months (phased approach)

---

## Phase 1: Foundation (Weeks 1-6)

### 1.1 Database & Multi-Tenancy

**Current**: No database (stateless)  
**Target**: PostgreSQL with multi-tenant architecture

```
┌─────────────────────────────────────────────────────┐
│                    Database Schema                   │
├─────────────────────────────────────────────────────┤
│  organizations (firms)                               │
│  ├── id, name, subscription_tier, settings          │
│  │                                                   │
│  users                                               │
│  ├── id, org_id, email, role, created_at            │
│  │                                                   │
│  clients                                             │
│  ├── id, org_id, name, tin, type, industry          │
│  │                                                   │
│  tax_computations                                    │
│  ├── id, client_id, user_id, tax_year, data, result │
│  │                                                   │
│  audit_logs                                          │
│  └── id, user_id, action, entity, timestamp, diff   │
└─────────────────────────────────────────────────────┘
```

**Implementation**:
- Add Prisma ORM with PostgreSQL (Supabase or self-hosted)
- Implement Row-Level Security (RLS) for data isolation
- Create migration scripts for schema versioning

### 1.2 Authentication & Authorization

**Current**: None  
**Target**: Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **Admin** | Full access, user management, org settings |
| **Partner** | All clients, approve computations, reports |
| **Manager** | Assigned clients, create/edit computations |
| **Associate** | Assigned clients, create drafts only |
| **Viewer** | Read-only access to assigned clients |

**Implementation**:
- NextAuth.js with credentials + SSO (Azure AD, Google Workspace)
- JWT tokens with role claims
- Middleware for route protection
- Session management with refresh tokens

### 1.3 Audit Trail & Compliance

**Current**: None  
**Target**: Complete audit logging for SOC 2 compliance

**Logged Events**:
- User login/logout with IP address
- All CRUD operations on computations
- Data exports (PDF, Excel)
- Permission changes
- Failed access attempts

**Implementation**:
```typescript
// lib/audit/logger.ts
interface AuditEntry {
  userId: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT';
  entity: 'computation' | 'client' | 'user';
  entityId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  previousData?: object;
  newData?: object;
}
```

---

## Phase 2: Tax Engine Enhancements (Weeks 7-12)

### 2.1 Finance Act Citations

**Current**: Generic notes  
**Target**: Specific legal references

```typescript
// lib/taxRules/citations.ts
interface TaxCitation {
  act: string;           // "Companies Income Tax Act 2007"
  section: string;       // "Section 13(1)(a)"
  description: string;
  effectiveDate: Date;
  expiryDate?: Date;     // For amended provisions
  url?: string;          // Link to official gazette
}

// Example usage in tax bands
const PIT_BANDS = [
  {
    min: 0,
    max: 300000,
    rate: 0.07,
    citation: {
      act: "Personal Income Tax Act 2011",
      section: "Schedule 1, Table 1",
      description: "First ₦300,000 at 7%"
    }
  },
  // ...
];
```

### 2.2 Capital Gains Tax (CGT) Module

**New Features**:
- Asset acquisition and disposal tracking
- Indexation allowance calculation
- CGT exemptions (primary residence, reinvestment relief)
- Nigerian CGT rate: 10%

```typescript
// lib/taxRules/cgt.ts
interface CGTInput {
  assetType: 'real_estate' | 'shares' | 'business' | 'other';
  acquisitionDate: Date;
  acquisitionCost: number;
  improvementCosts: number;
  disposalDate: Date;
  disposalProceeds: number;
  exemptions: CGTExemption[];
}

interface CGTResult {
  gain: number;
  indexedCost: number;
  exemptAmount: number;
  taxableGain: number;
  cgtPayable: number;
  citations: TaxCitation[];
}
```

### 2.3 Stamp Duties Calculator

**Implementation**:
- Document-based stamp duty rates
- State-specific variations
- Electronic vs physical documents

### 2.4 Transfer Pricing Module

**Features**:
- Related party transaction tracking
- Arm's length testing methods (CUP, CPM, TNMM)
- TP documentation generation
- Country-by-country reporting templates

### 2.5 Double Taxation Agreements

**Current**: None  
**Target**: Support for Nigeria's 15+ tax treaties

```typescript
// lib/taxRules/treaties.ts
interface TaxTreaty {
  country: string;
  effectiveDate: Date;
  reducedRates: {
    dividends: number;      // e.g., 7.5% instead of 10%
    interest: number;
    royalties: number;
    technicalFees: number;
  };
  exemptions: string[];
}
```

---

## Phase 3: Enterprise Features (Weeks 13-20)

### 3.1 Client Management Dashboard

**Features**:
- Client portfolio overview
- Tax calendar with deadlines
- Document repository per client
- Historical computations timeline
- Risk flags and alerts

### 3.2 Workflow & Approvals

**Implementation**:
```
Draft → Review → Approved → Filed
  ↑       ↓
  └── Rejected (with comments)
```

- Multi-level approval chains
- Email/Slack notifications
- Comments and annotations
- Version comparison (diff view)

### 3.3 Reporting & Analytics

**Reports**:
- Tax liability summary by client
- WHT deduction analysis
- VAT position tracking
- Effective tax rate trends
- Compliance status dashboard

**Export Formats**: PDF, Excel, CSV, JSON

### 3.4 API & Integrations

**REST API Endpoints**:
```
POST   /api/v1/clients
POST   /api/v1/computations
GET    /api/v1/computations/:id
POST   /api/v1/wht/calculate
GET    /api/v1/reports/summary
```

**Integrations**:
- ERP: SAP, Oracle, Sage
- Accounting: QuickBooks, Xero, Zoho Books
- Banks: Statement import (CSV/OFX)
- E-filing: FIRS TaxPro Max API (when available)

### 3.5 Bulk Operations

- CSV/Excel import for multiple clients
- Batch WHT calculations
- Mass report generation
- Annual filing prep wizard

---

## Phase 4: Security & Compliance (Weeks 21-24)

### 4.1 Security Measures

| Requirement | Implementation |
|-------------|----------------|
| Encryption at rest | PostgreSQL TDE / Supabase encryption |
| Encryption in transit | TLS 1.3, HSTS |
| Data residency | Nigerian hosting option (AWS Lagos) |
| Session security | HttpOnly cookies, CSRF protection |
| Rate limiting | Per-user/IP throttling |
| 2FA | TOTP (Google Authenticator, Authy) |

### 4.2 Compliance Certifications

**SOC 2 Type II Requirements**:
- [ ] Security policies documentation
- [ ] Access control procedures
- [ ] Change management process
- [ ] Incident response plan
- [ ] Vendor management policy
- [ ] Annual penetration testing

### 4.3 Data Retention & GDPR

- Configurable retention periods
- Data export on request
- Right to deletion (with legal holds)
- Anonymization for analytics

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Load Balancer                          │
│                    (Vercel / AWS ALB)                        │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                     Next.js Application                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   App Router │  │  API Routes  │  │  Server Actions  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌───────────────┐
│  PostgreSQL   │   │     Redis       │   │  File Storage │
│  (Supabase)   │   │   (Sessions)    │   │    (S3/R2)    │
└───────────────┘   └─────────────────┘   └───────────────┘
```

---

## Subscription Tiers

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| Users | 5 | 25 | Unlimited |
| Clients | 50 | 500 | Unlimited |
| Tax Modules | PIT, CIT, VAT, WHT | + CGT, Stamp Duties | + Transfer Pricing |
| API Access | No | Limited | Full |
| Support | Email | Priority Email | Dedicated Account Manager |
| SSO/SAML | No | No | Yes |
| Audit Logs | 30 days | 1 year | 7 years |
| Price (Monthly) | ₦50,000 | ₦250,000 | Custom |

---

## Development Priorities

### Immediate (Phase 1)
1. Database setup with Prisma + Supabase
2. NextAuth authentication
3. Basic RBAC implementation
4. Audit logging middleware

### Short-term (Phase 2)
1. Finance Act citations system
2. CGT module
3. Enhanced WHT with treaty rates

### Medium-term (Phase 3)
1. Client management UI
2. Workflow engine
3. REST API layer
4. Excel import/export

### Long-term (Phase 4)
1. Transfer pricing module
2. ERP integrations
3. SOC 2 certification
4. Mobile app consideration

---

## Conclusion

This roadmap transforms NaijaTaxAgent into a comprehensive enterprise tax platform capable of serving Nigeria's largest accounting firms and corporate tax departments. The phased approach allows for incremental delivery of value while building toward full enterprise capability.

**Next Steps**:
1. Finalize Phase 1 technical specifications
2. Set up development environment with database
3. Begin authentication implementation
4. Create detailed tickets for each feature

---

*Document Version: 1.0*  
*Last Updated: December 2024*
