/**
 * Account Keyword Map
 * Maps keywords and phrases to Chart of Account codes for intelligent transaction parsing.
 * 
 * Used by the sentence analyzer to identify both debit and credit accounts
 * from raw transaction text.
 */

export interface AccountMapping {
    code: string;
    name: string;
    normalSide: "debit" | "credit"; // Which side this account normally appears on
    priority: number; // Higher = preferred when multiple matches (0-100)
}

/**
 * Keywords mapped to specific accounts
 * Organized by account class for maintainability
 */
export const ACCOUNT_KEYWORD_MAP: Record<string, AccountMapping> = {
    // ============================================================================
    // ASSET ACCOUNTS (1000-1999) - Normally Debit
    // ============================================================================

    // Cash & Bank
    "cash": { code: "1000", name: "Cash", normalSide: "debit", priority: 90 },
    "cash in hand": { code: "1000", name: "Cash", normalSide: "debit", priority: 95 },
    "petty cash": { code: "1010", name: "Petty Cash", normalSide: "debit", priority: 90 },
    "bank": { code: "1020", name: "Bank", normalSide: "debit", priority: 90 },
    "bank account": { code: "1020", name: "Bank", normalSide: "debit", priority: 95 },
    "current account": { code: "1020", name: "Bank", normalSide: "debit", priority: 85 },
    "savings": { code: "1021", name: "Bank - Savings", normalSide: "debit", priority: 85 },
    "savings account": { code: "1021", name: "Bank - Savings", normalSide: "debit", priority: 90 },

    // Receivables
    "accounts receivable": { code: "1100", name: "Accounts Receivable", normalSide: "debit", priority: 95 },
    "trade receivable": { code: "1100", name: "Accounts Receivable", normalSide: "debit", priority: 90 },
    "receivable": { code: "1100", name: "Accounts Receivable", normalSide: "debit", priority: 80 },
    "debtor": { code: "1100", name: "Accounts Receivable", normalSide: "debit", priority: 85 },
    "debtors": { code: "1100", name: "Accounts Receivable", normalSide: "debit", priority: 85 },
    "customer owes": { code: "1100", name: "Accounts Receivable", normalSide: "debit", priority: 90 },

    // Inventory
    "inventory": { code: "1200", name: "Inventory", normalSide: "debit", priority: 90 },
    "stock": { code: "1200", name: "Inventory", normalSide: "debit", priority: 80 },
    "goods": { code: "1200", name: "Inventory", normalSide: "debit", priority: 70 },
    "merchandise": { code: "1200", name: "Inventory", normalSide: "debit", priority: 85 },
    "raw materials": { code: "1210", name: "Inventory - Raw Materials", normalSide: "debit", priority: 90 },
    "work in progress": { code: "1220", name: "Inventory - Work in Progress", normalSide: "debit", priority: 90 },
    "finished goods": { code: "1230", name: "Inventory - Finished Goods", normalSide: "debit", priority: 90 },

    // Prepaid Expenses
    "prepaid": { code: "1300", name: "Prepaid Expenses", normalSide: "debit", priority: 80 },
    "prepaid expense": { code: "1300", name: "Prepaid Expenses", normalSide: "debit", priority: 85 },
    "prepaid rent": { code: "1310", name: "Prepaid Rent", normalSide: "debit", priority: 90 },
    "prepaid insurance": { code: "1320", name: "Prepaid Insurance", normalSide: "debit", priority: 90 },

    // Tax Assets
    "input vat": { code: "1400", name: "Input VAT Receivable", normalSide: "debit", priority: 90 },
    "vat receivable": { code: "1400", name: "Input VAT Receivable", normalSide: "debit", priority: 90 },
    "wht receivable": { code: "1410", name: "WHT Receivable", normalSide: "debit", priority: 90 },

    // Fixed Assets
    "land": { code: "1500", name: "Land", normalSide: "debit", priority: 90 },
    "building": { code: "1510", name: "Buildings", normalSide: "debit", priority: 90 },
    "buildings": { code: "1510", name: "Buildings", normalSide: "debit", priority: 90 },
    "plant": { code: "1520", name: "Plant and Machinery", normalSide: "debit", priority: 85 },
    "machinery": { code: "1520", name: "Plant and Machinery", normalSide: "debit", priority: 85 },
    "machine": { code: "1520", name: "Plant and Machinery", normalSide: "debit", priority: 80 },
    "vehicle": { code: "1530", name: "Motor Vehicles", normalSide: "debit", priority: 90 },
    "motor vehicle": { code: "1530", name: "Motor Vehicles", normalSide: "debit", priority: 95 },
    "car": { code: "1530", name: "Motor Vehicles", normalSide: "debit", priority: 85 },
    "truck": { code: "1530", name: "Motor Vehicles", normalSide: "debit", priority: 85 },
    "motorcycle": { code: "1530", name: "Motor Vehicles", normalSide: "debit", priority: 85 },
    "equipment": { code: "1540", name: "Office Equipment", normalSide: "debit", priority: 85 },
    "office equipment": { code: "1540", name: "Office Equipment", normalSide: "debit", priority: 90 },
    "furniture": { code: "1550", name: "Furniture and Fittings", normalSide: "debit", priority: 90 },
    "fittings": { code: "1550", name: "Furniture and Fittings", normalSide: "debit", priority: 85 },
    "computer": { code: "1560", name: "Computer Equipment", normalSide: "debit", priority: 90 },
    "laptop": { code: "1560", name: "Computer Equipment", normalSide: "debit", priority: 90 },
    "desktop": { code: "1560", name: "Computer Equipment", normalSide: "debit", priority: 85 },

    // ============================================================================
    // LIABILITY ACCOUNTS (2000-2999) - Normally Credit
    // ============================================================================

    // Payables
    "accounts payable": { code: "2000", name: "Accounts Payable", normalSide: "credit", priority: 95 },
    "trade payable": { code: "2000", name: "Accounts Payable", normalSide: "credit", priority: 90 },
    "payable": { code: "2000", name: "Accounts Payable", normalSide: "credit", priority: 80 },
    "creditor": { code: "2000", name: "Accounts Payable", normalSide: "credit", priority: 85 },
    "creditors": { code: "2000", name: "Accounts Payable", normalSide: "credit", priority: 85 },
    "supplier": { code: "2000", name: "Accounts Payable", normalSide: "credit", priority: 80 },
    "we owe": { code: "2000", name: "Accounts Payable", normalSide: "credit", priority: 90 },
    "on credit": { code: "2000", name: "Accounts Payable", normalSide: "credit", priority: 75 },

    // Accrued
    "accrued": { code: "2100", name: "Accrued Expenses", normalSide: "credit", priority: 85 },
    "accrued expense": { code: "2100", name: "Accrued Expenses", normalSide: "credit", priority: 90 },
    "accrued expenses": { code: "2100", name: "Accrued Expenses", normalSide: "credit", priority: 90 },
    "accrued salary": { code: "2110", name: "Accrued Salaries", normalSide: "credit", priority: 90 },
    "accrued salaries": { code: "2110", name: "Accrued Salaries", normalSide: "credit", priority: 90 },
    "accrued interest": { code: "2120", name: "Accrued Interest", normalSide: "credit", priority: 90 },

    // Tax Liabilities
    "output vat": { code: "2200", name: "Output VAT Payable", normalSide: "credit", priority: 90 },
    "vat payable": { code: "2200", name: "Output VAT Payable", normalSide: "credit", priority: 90 },
    "paye": { code: "2210", name: "PAYE Payable", normalSide: "credit", priority: 90 },
    "paye payable": { code: "2210", name: "PAYE Payable", normalSide: "credit", priority: 95 },
    "wht payable": { code: "2220", name: "WHT Payable", normalSide: "credit", priority: 90 },
    "withholding tax": { code: "2220", name: "WHT Payable", normalSide: "credit", priority: 85 },
    "pension": { code: "2230", name: "Pension Payable", normalSide: "credit", priority: 85 },
    "pension payable": { code: "2230", name: "Pension Payable", normalSide: "credit", priority: 90 },
    "nhf": { code: "2240", name: "NHF Payable", normalSide: "credit", priority: 90 },
    "nsitf": { code: "2250", name: "NSITF Payable", normalSide: "credit", priority: 90 },
    "itf": { code: "2260", name: "ITF Payable", normalSide: "credit", priority: 90 },

    // Loans
    "short term loan": { code: "2300", name: "Short-term Loans", normalSide: "credit", priority: 90 },
    "bank overdraft": { code: "2310", name: "Bank Overdraft", normalSide: "credit", priority: 90 },
    "overdraft": { code: "2310", name: "Bank Overdraft", normalSide: "credit", priority: 85 },
    "loan": { code: "2500", name: "Long-term Loans", normalSide: "credit", priority: 80 },
    "bank loan": { code: "2500", name: "Long-term Loans", normalSide: "credit", priority: 90 },
    "borrowed": { code: "2500", name: "Long-term Loans", normalSide: "credit", priority: 85 },
    "mortgage": { code: "2510", name: "Mortgage Payable", normalSide: "credit", priority: 90 },

    // Unearned
    "unearned": { code: "2400", name: "Unearned Revenue", normalSide: "credit", priority: 85 },
    "unearned revenue": { code: "2400", name: "Unearned Revenue", normalSide: "credit", priority: 90 },
    "customer deposit": { code: "2410", name: "Customer Deposits", normalSide: "credit", priority: 90 },
    "deposit received": { code: "2410", name: "Customer Deposits", normalSide: "credit", priority: 90 },

    // ============================================================================
    // EQUITY ACCOUNTS (3000-3999) - Normally Credit
    // ============================================================================

    "capital": { code: "3000", name: "Owner's Capital", normalSide: "credit", priority: 85 },
    "owner capital": { code: "3000", name: "Owner's Capital", normalSide: "credit", priority: 90 },
    "owners capital": { code: "3000", name: "Owner's Capital", normalSide: "credit", priority: 90 },
    "invested": { code: "3000", name: "Owner's Capital", normalSide: "credit", priority: 80 },
    "investment": { code: "3000", name: "Owner's Capital", normalSide: "credit", priority: 75 },
    "share capital": { code: "3010", name: "Share Capital", normalSide: "credit", priority: 90 },
    "shares": { code: "3010", name: "Share Capital", normalSide: "credit", priority: 80 },
    "retained earnings": { code: "3100", name: "Retained Earnings", normalSide: "credit", priority: 90 },
    "drawing": { code: "3200", name: "Drawings", normalSide: "debit", priority: 90 },
    "drawings": { code: "3200", name: "Drawings", normalSide: "debit", priority: 90 },
    "withdrawal": { code: "3200", name: "Drawings", normalSide: "debit", priority: 85 },
    "owner withdrawal": { code: "3200", name: "Drawings", normalSide: "debit", priority: 90 },
    "dividend": { code: "3300", name: "Dividends Declared", normalSide: "debit", priority: 90 },
    "dividends": { code: "3300", name: "Dividends Declared", normalSide: "debit", priority: 90 },

    // ============================================================================
    // REVENUE ACCOUNTS (4000-4999) - Normally Credit
    // ============================================================================

    "sales": { code: "4000", name: "Sales", normalSide: "credit", priority: 90 },
    "revenue": { code: "4000", name: "Sales", normalSide: "credit", priority: 85 },
    "income": { code: "4000", name: "Sales", normalSide: "credit", priority: 75 },
    "sold": { code: "4000", name: "Sales", normalSide: "credit", priority: 85 },
    "service revenue": { code: "4010", name: "Service Revenue", normalSide: "credit", priority: 90 },
    "service income": { code: "4010", name: "Service Revenue", normalSide: "credit", priority: 85 },
    "contract revenue": { code: "4020", name: "Contract Revenue", normalSide: "credit", priority: 90 },
    "sales return": { code: "4100", name: "Sales Returns", normalSide: "debit", priority: 90 },
    "sales returns": { code: "4100", name: "Sales Returns", normalSide: "debit", priority: 90 },
    "sales discount": { code: "4110", name: "Sales Discounts", normalSide: "debit", priority: 90 },
    "interest income": { code: "4200", name: "Interest Income", normalSide: "credit", priority: 90 },
    "interest received": { code: "4200", name: "Interest Income", normalSide: "credit", priority: 90 },
    "dividend income": { code: "4210", name: "Dividend Income", normalSide: "credit", priority: 90 },
    "rental income": { code: "4220", name: "Rental Income", normalSide: "credit", priority: 90 },
    "rent income": { code: "4220", name: "Rental Income", normalSide: "credit", priority: 85 },
    "gain": { code: "4300", name: "Gain on Asset Disposal", normalSide: "credit", priority: 75 },
    "profit on sale": { code: "4300", name: "Gain on Asset Disposal", normalSide: "credit", priority: 85 },
    "forex gain": { code: "4400", name: "Foreign Exchange Gain", normalSide: "credit", priority: 90 },
    "exchange gain": { code: "4400", name: "Foreign Exchange Gain", normalSide: "credit", priority: 85 },
    "other income": { code: "4500", name: "Other Income", normalSide: "credit", priority: 70 },

    // ============================================================================
    // EXPENSE ACCOUNTS (5000-6999) - Normally Debit
    // ============================================================================

    // Cost of Sales
    "cost of goods sold": { code: "5000", name: "Cost of Goods Sold", normalSide: "debit", priority: 95 },
    "cogs": { code: "5000", name: "Cost of Goods Sold", normalSide: "debit", priority: 90 },
    "cost of sales": { code: "5000", name: "Cost of Goods Sold", normalSide: "debit", priority: 95 },
    "purchases": { code: "5010", name: "Purchases", normalSide: "debit", priority: 90 },
    "purchased": { code: "5010", name: "Purchases", normalSide: "debit", priority: 85 },
    "bought": { code: "5010", name: "Purchases", normalSide: "debit", priority: 80 },
    "resale": { code: "5010", name: "Purchases", normalSide: "debit", priority: 85 },
    "for resale": { code: "5010", name: "Purchases", normalSide: "debit", priority: 90 },
    "purchase return": { code: "5020", name: "Purchases Returns", normalSide: "credit", priority: 90 },
    "purchases returns": { code: "5020", name: "Purchases Returns", normalSide: "credit", priority: 90 },
    "direct labour": { code: "5040", name: "Direct Labour", normalSide: "debit", priority: 90 },
    "direct labor": { code: "5040", name: "Direct Labour", normalSide: "debit", priority: 90 },
    "freight": { code: "5060", name: "Freight-In", normalSide: "debit", priority: 85 },
    "shipping": { code: "5060", name: "Freight-In", normalSide: "debit", priority: 80 },

    // Operating Expenses
    "salary": { code: "5500", name: "Salaries and Wages", normalSide: "debit", priority: 90 },
    "salaries": { code: "5500", name: "Salaries and Wages", normalSide: "debit", priority: 90 },
    "wages": { code: "5500", name: "Salaries and Wages", normalSide: "debit", priority: 90 },
    "payroll": { code: "5500", name: "Salaries and Wages", normalSide: "debit", priority: 85 },
    "staff cost": { code: "5500", name: "Salaries and Wages", normalSide: "debit", priority: 85 },
    "staff welfare": { code: "5510", name: "Staff Welfare", normalSide: "debit", priority: 90 },
    "pension expense": { code: "5520", name: "Pension Expense", normalSide: "debit", priority: 90 },

    "rent": { code: "5600", name: "Rent Expense", normalSide: "debit", priority: 90 },
    "rent expense": { code: "5600", name: "Rent Expense", normalSide: "debit", priority: 95 },
    "lease": { code: "5600", name: "Rent Expense", normalSide: "debit", priority: 80 },
    "tenancy": { code: "5600", name: "Rent Expense", normalSide: "debit", priority: 85 },

    "utilities": { code: "5610", name: "Utilities Expense", normalSide: "debit", priority: 85 },
    "electricity": { code: "5610", name: "Utilities Expense", normalSide: "debit", priority: 90 },
    "power": { code: "5610", name: "Utilities Expense", normalSide: "debit", priority: 80 },
    "nepa": { code: "5610", name: "Utilities Expense", normalSide: "debit", priority: 95 },
    "phcn": { code: "5610", name: "Utilities Expense", normalSide: "debit", priority: 95 },
    "ekedc": { code: "5610", name: "Utilities Expense", normalSide: "debit", priority: 95 },
    "ikedc": { code: "5610", name: "Utilities Expense", normalSide: "debit", priority: 95 },
    "aedc": { code: "5610", name: "Utilities Expense", normalSide: "debit", priority: 95 },
    "kedco": { code: "5610", name: "Utilities Expense", normalSide: "debit", priority: 95 },
    "water": { code: "5610", name: "Utilities Expense", normalSide: "debit", priority: 85 },
    "generator": { code: "5610", name: "Utilities Expense", normalSide: "debit", priority: 80 },

    "telephone": { code: "5620", name: "Telephone and Internet", normalSide: "debit", priority: 90 },
    "phone": { code: "5620", name: "Telephone and Internet", normalSide: "debit", priority: 85 },
    "internet": { code: "5620", name: "Telephone and Internet", normalSide: "debit", priority: 90 },
    "data": { code: "5620", name: "Telephone and Internet", normalSide: "debit", priority: 75 },
    "airtime": { code: "5620", name: "Telephone and Internet", normalSide: "debit", priority: 90 },
    "mtn": { code: "5620", name: "Telephone and Internet", normalSide: "debit", priority: 95 },
    "glo": { code: "5620", name: "Telephone and Internet", normalSide: "debit", priority: 95 },
    "airtel": { code: "5620", name: "Telephone and Internet", normalSide: "debit", priority: 95 },
    "9mobile": { code: "5620", name: "Telephone and Internet", normalSide: "debit", priority: 95 },
    "spectranet": { code: "5620", name: "Telephone and Internet", normalSide: "debit", priority: 95 },
    "smile": { code: "5620", name: "Telephone and Internet", normalSide: "debit", priority: 90 },

    "depreciation": { code: "5700", name: "Depreciation Expense", normalSide: "debit", priority: 95 },
    "amortization": { code: "5710", name: "Amortization Expense", normalSide: "debit", priority: 90 },

    "insurance": { code: "5800", name: "Insurance Expense", normalSide: "debit", priority: 90 },
    "insurance expense": { code: "5800", name: "Insurance Expense", normalSide: "debit", priority: 95 },
    "premium": { code: "5800", name: "Insurance Expense", normalSide: "debit", priority: 75 },

    "repair": { code: "5810", name: "Repairs and Maintenance", normalSide: "debit", priority: 90 },
    "repairs": { code: "5810", name: "Repairs and Maintenance", normalSide: "debit", priority: 90 },
    "maintenance": { code: "5810", name: "Repairs and Maintenance", normalSide: "debit", priority: 90 },
    "servicing": { code: "5810", name: "Repairs and Maintenance", normalSide: "debit", priority: 85 },
    "fixing": { code: "5810", name: "Repairs and Maintenance", normalSide: "debit", priority: 80 },

    "office supplies": { code: "5820", name: "Office Supplies", normalSide: "debit", priority: 95 },
    "stationery": { code: "5820", name: "Office Supplies", normalSide: "debit", priority: 90 },
    "printing": { code: "5820", name: "Office Supplies", normalSide: "debit", priority: 80 },

    "professional fees": { code: "5900", name: "Professional Fees", normalSide: "debit", priority: 90 },
    "consultancy": { code: "5900", name: "Professional Fees", normalSide: "debit", priority: 85 },
    "consultant": { code: "5900", name: "Professional Fees", normalSide: "debit", priority: 85 },
    "advisory": { code: "5900", name: "Professional Fees", normalSide: "debit", priority: 80 },

    "audit": { code: "5910", name: "Audit Fees", normalSide: "debit", priority: 90 },
    "audit fees": { code: "5910", name: "Audit Fees", normalSide: "debit", priority: 95 },
    "accounting": { code: "5910", name: "Audit Fees", normalSide: "debit", priority: 75 },

    "legal": { code: "5920", name: "Legal Fees", normalSide: "debit", priority: 90 },
    "legal fees": { code: "5920", name: "Legal Fees", normalSide: "debit", priority: 95 },
    "lawyer": { code: "5920", name: "Legal Fees", normalSide: "debit", priority: 90 },
    "solicitor": { code: "5920", name: "Legal Fees", normalSide: "debit", priority: 90 },
    "attorney": { code: "5920", name: "Legal Fees", normalSide: "debit", priority: 85 },
    "court": { code: "5920", name: "Legal Fees", normalSide: "debit", priority: 80 },

    // Administrative Expenses
    "advertising": { code: "6000", name: "Advertising and Marketing", normalSide: "debit", priority: 90 },
    "marketing": { code: "6000", name: "Advertising and Marketing", normalSide: "debit", priority: 90 },
    "advert": { code: "6000", name: "Advertising and Marketing", normalSide: "debit", priority: 85 },
    "promo": { code: "6000", name: "Advertising and Marketing", normalSide: "debit", priority: 80 },
    "promotion": { code: "6000", name: "Advertising and Marketing", normalSide: "debit", priority: 85 },
    "campaign": { code: "6000", name: "Advertising and Marketing", normalSide: "debit", priority: 80 },

    "entertainment": { code: "6010", name: "Travel and Entertainment", normalSide: "debit", priority: 90 },
    "travel": { code: "6010", name: "Travel and Entertainment", normalSide: "debit", priority: 85 },
    "refreshment": { code: "6010", name: "Travel and Entertainment", normalSide: "debit", priority: 85 },
    "lunch": { code: "6010", name: "Travel and Entertainment", normalSide: "debit", priority: 80 },
    "dinner": { code: "6010", name: "Travel and Entertainment", normalSide: "debit", priority: 80 },
    "hospitality": { code: "6010", name: "Travel and Entertainment", normalSide: "debit", priority: 85 },
    "dstv": { code: "6010", name: "Travel and Entertainment", normalSide: "debit", priority: 90 },
    "gotv": { code: "6010", name: "Travel and Entertainment", normalSide: "debit", priority: 90 },

    "training": { code: "6020", name: "Training and Development", normalSide: "debit", priority: 90 },
    "seminar": { code: "6020", name: "Training and Development", normalSide: "debit", priority: 85 },
    "workshop": { code: "6020", name: "Training and Development", normalSide: "debit", priority: 85 },
    "conference": { code: "6020", name: "Training and Development", normalSide: "debit", priority: 85 },
    "course": { code: "6020", name: "Training and Development", normalSide: "debit", priority: 75 },

    "bank charge": { code: "6030", name: "Bank Charges", normalSide: "debit", priority: 95 },
    "bank charges": { code: "6030", name: "Bank Charges", normalSide: "debit", priority: 95 },
    "bank fee": { code: "6030", name: "Bank Charges", normalSide: "debit", priority: 90 },
    "service charge": { code: "6030", name: "Bank Charges", normalSide: "debit", priority: 85 },
    "atm charge": { code: "6030", name: "Bank Charges", normalSide: "debit", priority: 90 },
    "atm": { code: "6030", name: "Bank Charges", normalSide: "debit", priority: 70 },
    "cot": { code: "6030", name: "Bank Charges", normalSide: "debit", priority: 90 },
    "transfer fee": { code: "6030", name: "Bank Charges", normalSide: "debit", priority: 90 },

    "bad debt": { code: "6040", name: "Bad Debts Expense", normalSide: "debit", priority: 90 },
    "bad debts": { code: "6040", name: "Bad Debts Expense", normalSide: "debit", priority: 90 },
    "written off": { code: "6040", name: "Bad Debts Expense", normalSide: "debit", priority: 85 },

    "donation": { code: "6050", name: "Donations", normalSide: "debit", priority: 90 },
    "donations": { code: "6050", name: "Donations", normalSide: "debit", priority: 90 },
    "charity": { code: "6050", name: "Donations", normalSide: "debit", priority: 85 },

    "fine": { code: "6060", name: "Fines and Penalties", normalSide: "debit", priority: 85 },
    "fines": { code: "6060", name: "Fines and Penalties", normalSide: "debit", priority: 85 },
    "penalty": { code: "6060", name: "Fines and Penalties", normalSide: "debit", priority: 90 },
    "penalties": { code: "6060", name: "Fines and Penalties", normalSide: "debit", priority: 90 },

    "transport": { code: "6070", name: "Transport Expense", normalSide: "debit", priority: 90 },
    "fuel": { code: "6070", name: "Transport Expense", normalSide: "debit", priority: 90 },
    "petrol": { code: "6070", name: "Transport Expense", normalSide: "debit", priority: 90 },
    "diesel": { code: "6070", name: "Transport Expense", normalSide: "debit", priority: 90 },
    "uber": { code: "6070", name: "Transport Expense", normalSide: "debit", priority: 95 },
    "bolt": { code: "6070", name: "Transport Expense", normalSide: "debit", priority: 95 },
    "indriver": { code: "6070", name: "Transport Expense", normalSide: "debit", priority: 95 },
    "fare": { code: "6070", name: "Transport Expense", normalSide: "debit", priority: 85 },
    "taxi": { code: "6070", name: "Transport Expense", normalSide: "debit", priority: 90 },
    "logistics": { code: "6070", name: "Transport Expense", normalSide: "debit", priority: 80 },
    "delivery": { code: "6070", name: "Transport Expense", normalSide: "debit", priority: 75 },

    // Finance Costs
    "interest expense": { code: "6500", name: "Interest Expense", normalSide: "debit", priority: 95 },
    "interest paid": { code: "6500", name: "Interest Expense", normalSide: "debit", priority: 90 },
    "interest": { code: "6500", name: "Interest Expense", normalSide: "debit", priority: 75 },
    "loan fee": { code: "6500", name: "Interest Expense", normalSide: "debit", priority: 90 },
    "loan processing": { code: "6500", name: "Interest Expense", normalSide: "debit", priority: 90 },
    "processing fee": { code: "6500", name: "Interest Expense", normalSide: "debit", priority: 85 },
    "facility fee": { code: "6500", name: "Interest Expense", normalSide: "debit", priority: 85 },
    "finance charge": { code: "6500", name: "Interest Expense", normalSide: "debit", priority: 90 },
    "finance cost": { code: "6500", name: "Interest Expense", normalSide: "debit", priority: 90 },

    "forex loss": { code: "6600", name: "Foreign Exchange Loss", normalSide: "debit", priority: 90 },
    "exchange loss": { code: "6600", name: "Foreign Exchange Loss", normalSide: "debit", priority: 85 },

    // Tax Expenses
    "income tax": { code: "7000", name: "Income Tax Expense", normalSide: "debit", priority: 90 },
    "company tax": { code: "7000", name: "Income Tax Expense", normalSide: "debit", priority: 85 },
    "tet": { code: "7010", name: "Tertiary Education Tax", normalSide: "debit", priority: 90 },
    "tertiary education tax": { code: "7010", name: "Tertiary Education Tax", normalSide: "debit", priority: 95 },
};

/**
 * Action verbs that indicate transaction flow direction
 */
export const ACTION_VERBS = {
    // Money OUT (we pay) - Debit expense/asset, Credit cash
    outflow: [
        "paid", "pay", "paying",
        "bought", "buy", "buying", "purchased", "purchase", "purchasing",
        "spent", "spend", "spending",
        "settled", "settle",
        "repaid", "repay",
        "withdrew", "withdraw",
        "remitted", "remit",
    ],

    // Money IN (we receive) - Debit cash, Credit revenue/liability
    inflow: [
        "received", "receive", "receiving",
        "sold", "sell", "selling",
        "earned", "earn",
        "collected", "collect",
        "borrowed", "borrow",
        "deposited", "deposit",
        "got", "get",
    ],

    // Transfers (internal movement)
    transfer: [
        "transferred", "transfer",
        "moved", "move",
    ],
};

/**
 * Get all keywords sorted by priority (highest first)
 */
export function getKeywordsByPriority(): Array<{ keyword: string; mapping: AccountMapping }> {
    return Object.entries(ACCOUNT_KEYWORD_MAP)
        .map(([keyword, mapping]) => ({ keyword, mapping }))
        .sort((a, b) => b.mapping.priority - a.mapping.priority);
}

/**
 * Find account by keyword
 */
export function findAccountByKeyword(keyword: string): AccountMapping | undefined {
    return ACCOUNT_KEYWORD_MAP[keyword.toLowerCase()];
}
