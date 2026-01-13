# 2-Layer AI Transaction Validation System

## Overview

A hybrid validation system that combines fast rule-based logic with AI-powered verification to ensure 100% accurate transaction classification and Nigerian tax compliance.

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INPUT                                    │
│              "Cash Sale of Goods 107,500"                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: SYSTEM LOGIC (Fast, Rule-Based)                       │
│  ─────────────────────────────────────────                      │
│  • Keyword matching from accountKeywordMap.ts                   │
│  • Sentence analysis from sentenceAnalyzer.ts                   │
│  • Action verb detection (inflow/outflow)                       │
│                                                                 │
│  OUTPUT:                                                        │
│  {                                                              │
│    debitAccount: { code: "1020", name: "Bank" },               │
│    creditAccount: { code: "4000", name: "Sales" },             │
│    amount: 107500,                                              │
│    nature: "sale_of_goods",                                     │
│    taxImplications: { vat: 7500, wht: 0, paye: 0, cgt: 0 }     │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: AI VERIFICATION (Google Gemini API)                   │
│  ─────────────────────────────────────────────                  │
│  • Reviews system interpretation                                │
│  • Validates accounting logic (correct accounts?)               │
│  • Validates tax logic (correct VAT/WHT/CGT/PAYE?)             │
│  • Applies Nigerian FIRS rules                                  │
│  • Corrects any inconsistencies found                          │
│                                                                 │
│  OUTPUT:                                                        │
│  {                                                              │
│    validated: true,                                             │
│    corrected: false,                                            │
│    corrections: [],                                             │
│    finalInterpretation: { ... },                               │
│    confidence: 0.95,                                            │
│    reasoning: "Cash sale correctly classified..."               │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              FINAL VALIDATED OUTPUT                              │
│              Posted to Journal ✅                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: System Logic

### Files Involved
| File | Purpose |
|------|---------|
| `accountKeywordMap.ts` | Keyword → Account code mapping |
| `sentenceAnalyzer.ts` | Transaction text analysis |
| `transactionBridge.ts` | Transaction processing bridge |
| `transactionTaxAnalyzer.ts` | Tax calculation logic |

### How It Works
1. **Extract keywords** from transaction narration
2. **Detect flow direction** (inflow/outflow) from action verbs
3. **Match accounts** using priority-weighted keyword map
4. **Classify transaction nature** (sale_of_goods, purchase_services, etc.)
5. **Calculate taxes** based on nature (VAT, WHT, PAYE, CGT)

### Strengths
- ⚡ **Fast** - No API latency
- 💰 **Free** - No API costs
- 🔌 **Offline** - Works without internet

### Weaknesses
- ❌ Limited understanding of context
- ❌ New transaction types need manual keyword additions
- ❌ Can misclassify edge cases

---

## Layer 2: AI Verification

### Purpose
Act as a **smart reviewer** that catches mistakes the rule-based system might make.

### API
- **Provider**: Google Gemini API
- **Model**: `gemini-1.5-flash` or `gemini-1.5-pro`
- **Endpoint**: Via `@google/generative-ai` npm package

### Input to AI
```json
{
  "transactionText": "Cash Sale of Goods 107,500",
  "systemInterpretation": {
    "debitAccount": { "code": "1020", "name": "Bank" },
    "creditAccount": { "code": "4000", "name": "Sales" },
    "amount": 107500,
    "nature": "sale_of_goods",
    "taxImplications": { "outputVAT": 7500 }
  },
  "chartOfAccounts": [...],
  "context": "Nigerian business, FIRS-compliant"
}
```

### AI Prompt Structure
```
You are a Nigerian Chartered Accountant and Tax Expert.

TASK: Review the transaction interpretation below and validate:
1. ACCOUNTING LOGIC: Are debit/credit accounts correct?
2. TAX LOGIC: Is VAT/WHT/PAYE/CGT treatment correct per FIRS rules?

RULES:
- VAT @ 7.5% on goods and services
- WHT @ 10% on professional services (legal, audit, consulting)
- PAYE: Graduated rates with CRA relief
- CGT @ 10% on capital gains (not full proceeds)
- Asset disposals are NOT VATable

If incorrect, provide corrections with reasoning.
```

### Output from AI
```json
{
  "validated": true,
  "corrected": false,
  "corrections": [],
  "finalInterpretation": {
    "debitAccount": { "code": "1020", "name": "Bank" },
    "creditAccount": { "code": "4000", "name": "Sales" },
    "amount": 107500,
    "nature": "sale_of_goods",
    "taxImplications": { "outputVAT": 7500 }
  },
  "confidence": 0.95,
  "reasoning": "System correctly identified cash sale with VAT."
}
```

### When AI Corrects
Example: System misclassifies "Credit Purchase of Inventory" as Office Supplies

```json
{
  "validated": false,
  "corrected": true,
  "corrections": [
    {
      "field": "debitAccount",
      "was": { "code": "5820", "name": "Office Supplies" },
      "correctedTo": { "code": "5010", "name": "Purchases" },
      "reason": "Narration says 'Inventory' - this is a purchase of goods for resale"
    },
    {
      "field": "creditAccount",
      "was": { "code": "1020", "name": "Bank" },
      "correctedTo": { "code": "2000", "name": "Accounts Payable" },
      "reason": "'Credit purchase' indicates payment on credit, not cash"
    }
  ],
  "confidence": 0.98,
  "reasoning": "Corrected from Office Supplies to Purchases based on 'Inventory' keyword."
}
```

---

## File Structure

```
lib/accounting/
├── accountKeywordMap.ts       # Layer 1: Keywords
├── sentenceAnalyzer.ts        # Layer 1: Text analysis
├── transactionBridge.ts       # Layer 1: Processing
├── transactionTaxAnalyzer.ts  # Tax calculation
│
├── aiTransactionValidator.ts  # Layer 2: AI validation (NEW)
└── validatedTransactionPost.ts # Final posting (NEW)
```

---

## Environment Variables

```env
# Google Gemini API Key
GOOGLE_GEMINI_API_KEY=your_api_key_here

# Enable/Disable AI validation (fallback to Layer 1 only)
ENABLE_AI_VALIDATION=true
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| API key missing | Use Layer 1 only, log warning |
| API timeout | Use Layer 1 result, retry in background |
| API rate limit | Queue request, use Layer 1 temporarily |
| API error | Use Layer 1 result, log error for review |

---

## Audit Trail

Every transaction logs:
```json
{
  "timestamp": "2026-01-11T18:30:00Z",
  "transactionId": "JE-ABC123",
  "layer1Result": { ... },
  "layer2Result": { ... },
  "aiCorrectionsMade": true,
  "finalResult": { ... }
}
```

---

## Tax Rules Embedded in AI Prompt

| Tax | Rule |
|-----|------|
| **VAT** | 7.5% on goods/services. Asset disposals exempt. |
| **WHT** | 10% on professional services (legal, audit, consulting) |
| **PAYE** | Graduated rates: 7%-24% with CRA relief |
| **CGT** | 10% on GAIN (Proceeds - Cost), not full proceeds |
| **CIT** | 0% small company, 20% medium, 30% large |

---

## Next Steps

1. ✅ README created
2. ⏳ Implement `aiTransactionValidator.ts`
3. ⏳ Integrate with existing transaction flow
4. ⏳ Test with sample transactions
5. ⏳ Add audit logging
