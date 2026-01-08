/**
 * COMPREHENSIVE TRANSACTION PARSER TEST SUITE
 * Tests natural language parsing accuracy across all IFRS account types
 * Target: 90%+ accuracy
 */

import { parseTransactionFromChat } from '../transactionBridge';

// Test case structure
interface TestCase {
    id: number;
    input: string;
    expectedType: string;
    expectedAmount: number;
    expectedCategory: string;
    expectedDebitAccount?: string;
    expectedCreditAccount?: string;
    description: string;
}

// ============================================================================
// TEST CASES ORGANIZED BY IFRS ACCOUNT CLASS
// ============================================================================

const testCases: TestCase[] = [
    // ===== ASSET TRANSACTIONS =====

    // Cash & Bank (1000-1030)
    { id: 1, input: "received cash 50000", expectedType: "receipt", expectedAmount: 50000, expectedCategory: "income", description: "Cash receipt" },
    { id: 2, input: "cash sales 75000", expectedType: "sale", expectedAmount: 75000, expectedCategory: "sales", description: "Cash sales" },
    { id: 3, input: "deposited 200000 to bank", expectedType: "transfer", expectedAmount: 200000, expectedCategory: "transfer", description: "Bank deposit" },
    { id: 4, input: "withdrew 30000 from bank", expectedType: "transfer", expectedAmount: 30000, expectedCategory: "transfer", description: "Bank withdrawal" },
    { id: 5, input: "bank transfer received 100000", expectedType: "receipt", expectedAmount: 100000, expectedCategory: "income", description: "Bank transfer in" },
    { id: 6, input: "petty cash replenishment 10000", expectedType: "transfer", expectedAmount: 10000, expectedCategory: "transfer", description: "Petty cash" },

    // Accounts Receivable (1100)
    { id: 7, input: "sold goods on credit 150000", expectedType: "sale", expectedAmount: 150000, expectedCategory: "sales", description: "Credit sale" },
    { id: 8, input: "customer paid outstanding invoice 80000", expectedType: "receipt", expectedAmount: 80000, expectedCategory: "receipt", description: "Customer payment" },
    { id: 9, input: "received from debtor 45000", expectedType: "receipt", expectedAmount: 45000, expectedCategory: "receipt", description: "Debtor payment" },
    { id: 10, input: "invoice customer 200000 for services", expectedType: "sale", expectedAmount: 200000, expectedCategory: "service", description: "Service invoice" },
    { id: 11, input: "collected receivables 120000", expectedType: "receipt", expectedAmount: 120000, expectedCategory: "receipt", description: "Receivables collection" },

    // Inventory (1200-1220)
    { id: 12, input: "purchased inventory 500000", expectedType: "purchase", expectedAmount: 500000, expectedCategory: "purchases", description: "Inventory purchase" },
    { id: 13, input: "bought stock 250000", expectedType: "purchase", expectedAmount: 250000, expectedCategory: "purchases", description: "Stock purchase" },
    { id: 14, input: "purchase goods 180000", expectedType: "purchase", expectedAmount: 180000, expectedCategory: "purchases", description: "Goods purchase" },
    { id: 15, input: "bought raw materials 300000", expectedType: "purchase", expectedAmount: 300000, expectedCategory: "purchases", description: "Raw materials" },
    { id: 16, input: "purchased merchandise 420000", expectedType: "purchase", expectedAmount: 420000, expectedCategory: "purchases", description: "Merchandise purchase" },
    { id: 17, input: "inventory from supplier 1500000", expectedType: "purchase", expectedAmount: 1500000, expectedCategory: "purchases", description: "Supplier inventory" },
    { id: 18, input: "purchase braids 500", expectedType: "purchase", expectedAmount: 500, expectedCategory: "purchases", description: "Generic product purchase" },
    { id: 19, input: "bought wigs 25000", expectedType: "purchase", expectedAmount: 25000, expectedCategory: "purchases", description: "Product purchase" },
    { id: 20, input: "purchased phones for resale 800000", expectedType: "purchase", expectedAmount: 800000, expectedCategory: "purchases", description: "Inventory for resale" },

    // Prepaid Expenses (1300-1320)
    { id: 21, input: "paid rent in advance 600000", expectedType: "expense", expectedAmount: 600000, expectedCategory: "rent", description: "Prepaid rent" },
    { id: 22, input: "prepaid insurance 120000", expectedType: "expense", expectedAmount: 120000, expectedCategory: "expense", description: "Prepaid insurance" },
    { id: 23, input: "advance payment for supplies 50000", expectedType: "expense", expectedAmount: 50000, expectedCategory: "expense", description: "Prepayment" },

    // Fixed Assets (1500-1560)
    { id: 24, input: "bought laptop 450000", expectedType: "asset", expectedAmount: 450000, expectedCategory: "asset", description: "Laptop purchase" },
    { id: 25, input: "purchased office equipment 200000", expectedType: "asset", expectedAmount: 200000, expectedCategory: "asset", description: "Equipment purchase" },
    { id: 26, input: "bought company vehicle 8500000", expectedType: "asset", expectedAmount: 8500000, expectedCategory: "asset", description: "Vehicle purchase" },
    { id: 27, input: "purchased furniture 350000", expectedType: "asset", expectedAmount: 350000, expectedCategory: "asset", description: "Furniture purchase" },
    { id: 28, input: "bought machinery 2500000", expectedType: "asset", expectedAmount: 2500000, expectedCategory: "asset", description: "Machinery purchase" },
    { id: 29, input: "acquired computer 180000", expectedType: "asset", expectedAmount: 180000, expectedCategory: "asset", description: "Computer purchase" },
    { id: 30, input: "purchased building 50000000", expectedType: "asset", expectedAmount: 50000000, expectedCategory: "asset", description: "Building purchase" },
    { id: 31, input: "bought generator 1500000", expectedType: "asset", expectedAmount: 1500000, expectedCategory: "asset", description: "Generator as equipment" },
    { id: 32, input: "purchased air conditioner 250000", expectedType: "asset", expectedAmount: 250000, expectedCategory: "asset", description: "AC as equipment" },

    // ===== LIABILITY TRANSACTIONS =====

    // Accounts Payable (2000)
    { id: 33, input: "bought goods on credit from supplier 300000", expectedType: "purchase", expectedAmount: 300000, expectedCategory: "purchases", description: "Credit purchase" },
    { id: 34, input: "paid supplier 150000", expectedType: "payment", expectedAmount: 150000, expectedCategory: "supplier-payment", description: "Supplier payment" },
    { id: 35, input: "settled creditor 80000", expectedType: "payment", expectedAmount: 80000, expectedCategory: "supplier-payment", description: "Creditor settlement" },
    { id: 36, input: "paid vendor 200000", expectedType: "payment", expectedAmount: 200000, expectedCategory: "supplier-payment", description: "Vendor payment" },
    { id: 37, input: "paid outstanding payables 500000", expectedType: "payment", expectedAmount: 500000, expectedCategory: "supplier-payment", description: "Payables settlement" },

    // Accrued Expenses (2100-2110)
    { id: 38, input: "accrued salaries 850000", expectedType: "expense", expectedAmount: 850000, expectedCategory: "salary", description: "Salary accrual" },
    { id: 39, input: "outstanding rent bill 200000", expectedType: "expense", expectedAmount: 200000, expectedCategory: "rent", description: "Rent accrual" },
    { id: 40, input: "incurred expenses not yet paid 75000", expectedType: "expense", expectedAmount: 75000, expectedCategory: "expense", description: "Expense accrual" },

    // VAT Payable (2200)
    { id: 41, input: "collected VAT on sales 37500", expectedType: "sale", expectedAmount: 37500, expectedCategory: "sales", description: "VAT collection" },
    { id: 42, input: "remitted VAT to FIRS 50000", expectedType: "payment", expectedAmount: 50000, expectedCategory: "expense", description: "VAT remittance" },

    // PAYE/WHT Payable (2210-2220)
    { id: 43, input: "paid PAYE tax 120000", expectedType: "payment", expectedAmount: 120000, expectedCategory: "expense", description: "PAYE payment" },
    { id: 44, input: "remitted withholding tax 25000", expectedType: "payment", expectedAmount: 25000, expectedCategory: "expense", description: "WHT remittance" },

    // Loans (2300, 2500)
    { id: 45, input: "received bank loan 5000000", expectedType: "loan", expectedAmount: 5000000, expectedCategory: "loan-received", description: "Loan received" },
    { id: 46, input: "borrowed money 1000000", expectedType: "loan", expectedAmount: 1000000, expectedCategory: "loan", description: "Borrowed funds" },
    { id: 47, input: "repaid loan 250000", expectedType: "payment", expectedAmount: 250000, expectedCategory: "loan-repayment", description: "Loan repayment" },
    { id: 48, input: "loan repayment 500000", expectedType: "payment", expectedAmount: 500000, expectedCategory: "loan-repayment", description: "Loan installment" },
    { id: 49, input: "paid bank loan 300000", expectedType: "payment", expectedAmount: 300000, expectedCategory: "loan-repayment", description: "Bank loan payment" },

    // Deferred Revenue (2400)
    { id: 50, input: "received advance from customer 100000", expectedType: "receipt", expectedAmount: 100000, expectedCategory: "income", description: "Customer advance" },
    { id: 51, input: "deposit from client 200000", expectedType: "receipt", expectedAmount: 200000, expectedCategory: "income", description: "Client deposit" },

    // ===== EQUITY TRANSACTIONS =====

    // Share Capital / Owner Investment (3000)
    { id: 52, input: "owner invested 5000000", expectedType: "equity", expectedAmount: 5000000, expectedCategory: "capital", description: "Owner investment" },
    { id: 53, input: "capital contribution 2000000", expectedType: "equity", expectedAmount: 2000000, expectedCategory: "capital", description: "Capital contribution" },
    { id: 54, input: "started business with 10000000", expectedType: "equity", expectedAmount: 10000000, expectedCategory: "capital", description: "Initial capital" },
    { id: 55, input: "added capital 1500000", expectedType: "equity", expectedAmount: 1500000, expectedCategory: "capital", description: "Additional capital" },

    // Drawings (3200)
    { id: 56, input: "owner withdrew 100000", expectedType: "equity", expectedAmount: 100000, expectedCategory: "drawing", description: "Owner drawing" },
    { id: 57, input: "personal drawing 50000", expectedType: "equity", expectedAmount: 50000, expectedCategory: "drawing", description: "Personal drawing" },
    { id: 58, input: "took money for personal use 75000", expectedType: "equity", expectedAmount: 75000, expectedCategory: "drawing", description: "Personal withdrawal" },

    // Dividends (3400)
    { id: 59, input: "paid dividends 500000", expectedType: "payment", expectedAmount: 500000, expectedCategory: "expense", description: "Dividend payment" },
    { id: 60, input: "declared dividend 1000000", expectedType: "other", expectedAmount: 1000000, expectedCategory: "other", description: "Dividend declaration" },

    // ===== REVENUE TRANSACTIONS =====

    // Sales Revenue (4000)
    { id: 61, input: "sold goods 250000", expectedType: "sale", expectedAmount: 250000, expectedCategory: "sales", description: "Goods sale" },
    { id: 62, input: "cash sale 85000", expectedType: "sale", expectedAmount: 85000, expectedCategory: "sales", description: "Cash sale" },
    { id: 63, input: "sales 150000", expectedType: "sale", expectedAmount: 150000, expectedCategory: "sales", description: "General sale" },
    { id: 64, input: "sold products for 320000", expectedType: "sale", expectedAmount: 320000, expectedCategory: "sales", description: "Product sale" },
    { id: 65, input: "revenue from sales 1500000", expectedType: "sale", expectedAmount: 1500000, expectedCategory: "sales", description: "Sales revenue" },
    { id: 66, input: "sold 7x braid 5500", expectedType: "sale", expectedAmount: 5500, expectedCategory: "sales", description: "Product name sale" },
    { id: 67, input: "sold hair products 45000", expectedType: "sale", expectedAmount: 45000, expectedCategory: "sales", description: "Category sale" },

    // Service Revenue (4010)
    { id: 68, input: "service fee 150000", expectedType: "sale", expectedAmount: 150000, expectedCategory: "service", description: "Service fee" },
    { id: 69, input: "consultancy fee 500000", expectedType: "sale", expectedAmount: 500000, expectedCategory: "service", description: "Consultancy" },
    { id: 70, input: "professional service rendered 300000", expectedType: "sale", expectedAmount: 300000, expectedCategory: "service", description: "Professional service" },
    { id: 71, input: "received for services 200000", expectedType: "sale", expectedAmount: 200000, expectedCategory: "service", description: "Service payment" },

    // Contract Revenue (4020)
    { id: 72, input: "contract payment 2500000", expectedType: "receipt", expectedAmount: 2500000, expectedCategory: "income", description: "Contract payment" },
    { id: 73, input: "received contract sum 5000000", expectedType: "receipt", expectedAmount: 5000000, expectedCategory: "income", description: "Contract sum" },

    // Interest Income (4200)
    { id: 74, input: "interest received 15000", expectedType: "receipt", expectedAmount: 15000, expectedCategory: "income", description: "Interest income" },
    { id: 75, input: "bank interest 8500", expectedType: "receipt", expectedAmount: 8500, expectedCategory: "income", description: "Bank interest" },
    { id: 76, input: "earned interest on savings 12000", expectedType: "receipt", expectedAmount: 12000, expectedCategory: "income", description: "Savings interest" },

    // Rental Income (4220)
    { id: 77, input: "rent received 350000", expectedType: "receipt", expectedAmount: 350000, expectedCategory: "income", description: "Rental income" },
    { id: 78, input: "rental income 200000", expectedType: "receipt", expectedAmount: 200000, expectedCategory: "income", description: "Property rent" },

    // Sales Returns (4100)
    { id: 79, input: "customer returned goods 25000", expectedType: "other", expectedAmount: 25000, expectedCategory: "other", description: "Sales return" },
    { id: 80, input: "refund to customer 15000", expectedType: "other", expectedAmount: 15000, expectedCategory: "other", description: "Customer refund" },

    // ===== EXPENSE TRANSACTIONS =====

    // Cost of Goods Sold (5000-5040)
    { id: 81, input: "cost of goods sold 180000", expectedType: "expense", expectedAmount: 180000, expectedCategory: "expense", description: "COGS" },
    { id: 82, input: "direct materials used 250000", expectedType: "expense", expectedAmount: 250000, expectedCategory: "expense", description: "Direct materials" },
    { id: 83, input: "production wages 120000", expectedType: "expense", expectedAmount: 120000, expectedCategory: "salary", description: "Production labor" },
    { id: 84, input: "freight cost 35000", expectedType: "expense", expectedAmount: 35000, expectedCategory: "transport", description: "Freight in" },

    // Salaries and Wages (5500-5540)
    { id: 85, input: "paid salaries 1500000", expectedType: "expense", expectedAmount: 1500000, expectedCategory: "salary", description: "Salary payment" },
    { id: 86, input: "staff wages 850000", expectedType: "expense", expectedAmount: 850000, expectedCategory: "salary", description: "Wages payment" },
    { id: 87, input: "payroll 2000000", expectedType: "expense", expectedAmount: 2000000, expectedCategory: "salary", description: "Payroll" },
    { id: 88, input: "salary expense 1200000", expectedType: "expense", expectedAmount: 1200000, expectedCategory: "salary", description: "Salary expense" },
    { id: 89, input: "paid employee bonus 300000", expectedType: "expense", expectedAmount: 300000, expectedCategory: "salary", description: "Bonus payment" },
    { id: 90, input: "staff welfare 50000", expectedType: "expense", expectedAmount: 50000, expectedCategory: "expense", description: "Staff welfare" },
    { id: 91, input: "paid pension contribution 180000", expectedType: "expense", expectedAmount: 180000, expectedCategory: "expense", description: "Pension contribution" },

    // Rent Expense (5600)
    { id: 92, input: "paid rent 500000", expectedType: "expense", expectedAmount: 500000, expectedCategory: "rent", description: "Rent payment" },
    { id: 93, input: "office rent 350000", expectedType: "expense", expectedAmount: 350000, expectedCategory: "rent", description: "Office rent" },
    { id: 94, input: "shop rent 200000", expectedType: "expense", expectedAmount: 200000, expectedCategory: "rent", description: "Shop rent" },
    { id: 95, input: "rent expense 400000", expectedType: "expense", expectedAmount: 400000, expectedCategory: "rent", description: "Rent expense" },

    // Utilities (5610-5620)
    { id: 96, input: "paid electricity bill 45000", expectedType: "expense", expectedAmount: 45000, expectedCategory: "utilities", description: "Electricity" },
    { id: 97, input: "NEPA bill 35000", expectedType: "expense", expectedAmount: 35000, expectedCategory: "utilities", description: "Power bill" },
    { id: 98, input: "paid water bill 8000", expectedType: "expense", expectedAmount: 8000, expectedCategory: "utilities", description: "Water bill" },
    { id: 99, input: "internet subscription 25000", expectedType: "expense", expectedAmount: 25000, expectedCategory: "utilities", description: "Internet" },
    { id: 100, input: "phone bill 15000", expectedType: "expense", expectedAmount: 15000, expectedCategory: "utilities", description: "Phone" },
    { id: 101, input: "bought airtime 5000", expectedType: "expense", expectedAmount: 5000, expectedCategory: "utilities", description: "Airtime" },
    { id: 102, input: "data subscription 10000", expectedType: "expense", expectedAmount: 10000, expectedCategory: "utilities", description: "Data" },

    // Insurance (5800)
    { id: 103, input: "paid insurance premium 250000", expectedType: "expense", expectedAmount: 250000, expectedCategory: "expense", description: "Insurance premium" },
    { id: 104, input: "insurance expense 180000", expectedType: "expense", expectedAmount: 180000, expectedCategory: "expense", description: "Insurance expense" },
    { id: 105, input: "vehicle insurance 120000", expectedType: "expense", expectedAmount: 120000, expectedCategory: "expense", description: "Vehicle insurance" },

    // Repairs and Maintenance (5810)
    { id: 106, input: "paid for repairs 75000", expectedType: "expense", expectedAmount: 75000, expectedCategory: "expense", description: "Repairs" },
    { id: 107, input: "maintenance cost 50000", expectedType: "expense", expectedAmount: 50000, expectedCategory: "expense", description: "Maintenance" },
    { id: 108, input: "vehicle servicing 35000", expectedType: "expense", expectedAmount: 35000, expectedCategory: "expense", description: "Vehicle service" },
    { id: 109, input: "generator maintenance 25000", expectedType: "expense", expectedAmount: 25000, expectedCategory: "expense", description: "Generator maintenance" },

    // Office Supplies (5820)
    { id: 110, input: "bought office supplies 15000", expectedType: "expense", expectedAmount: 15000, expectedCategory: "expense", description: "Office supplies" },
    { id: 111, input: "stationery 8000", expectedType: "expense", expectedAmount: 8000, expectedCategory: "expense", description: "Stationery" },
    { id: 112, input: "printing paper 5000", expectedType: "expense", expectedAmount: 5000, expectedCategory: "expense", description: "Printing supplies" },

    // Professional Fees (5900-5920)
    { id: 113, input: "paid legal fees 200000", expectedType: "expense", expectedAmount: 200000, expectedCategory: "expense", description: "Legal fees" },
    { id: 114, input: "audit fee 350000", expectedType: "expense", expectedAmount: 350000, expectedCategory: "expense", description: "Audit fees" },
    { id: 115, input: "accounting fee 150000", expectedType: "expense", expectedAmount: 150000, expectedCategory: "expense", description: "Accounting fees" },
    { id: 116, input: "consultancy fees 500000", expectedType: "expense", expectedAmount: 500000, expectedCategory: "expense", description: "Consultancy fees" },
    { id: 117, input: "professional fees 250000", expectedType: "expense", expectedAmount: 250000, expectedCategory: "expense", description: "Professional fees" },

    // Advertising and Marketing (6000)
    { id: 118, input: "advertising expense 100000", expectedType: "expense", expectedAmount: 100000, expectedCategory: "expense", description: "Advertising" },
    { id: 119, input: "marketing cost 150000", expectedType: "expense", expectedAmount: 150000, expectedCategory: "expense", description: "Marketing" },
    { id: 120, input: "paid for advert 80000", expectedType: "expense", expectedAmount: 80000, expectedCategory: "expense", description: "Advert payment" },
    { id: 121, input: "promotion expense 50000", expectedType: "expense", expectedAmount: 50000, expectedCategory: "expense", description: "Promotion" },

    // Travel and Entertainment (6010)
    { id: 122, input: "travel expense 85000", expectedType: "expense", expectedAmount: 85000, expectedCategory: "expense", description: "Travel" },
    { id: 123, input: "entertainment 25000", expectedType: "expense", expectedAmount: 25000, expectedCategory: "expense", description: "Entertainment" },
    { id: 124, input: "refreshment 15000", expectedType: "expense", expectedAmount: 15000, expectedCategory: "expense", description: "Refreshment" },
    { id: 125, input: "business meals 12000", expectedType: "expense", expectedAmount: 12000, expectedCategory: "expense", description: "Business meals" },

    // Training (6020)
    { id: 126, input: "staff training 200000", expectedType: "expense", expectedAmount: 200000, expectedCategory: "expense", description: "Staff training" },
    { id: 127, input: "paid for training course 150000", expectedType: "expense", expectedAmount: 150000, expectedCategory: "expense", description: "Training course" },
    { id: 128, input: "seminar fee 50000", expectedType: "expense", expectedAmount: 50000, expectedCategory: "expense", description: "Seminar" },

    // Bank Charges (6030)
    { id: 129, input: "bank charges 5000", expectedType: "expense", expectedAmount: 5000, expectedCategory: "expense", description: "Bank charges" },
    { id: 130, input: "bank commission 3500", expectedType: "expense", expectedAmount: 3500, expectedCategory: "expense", description: "Bank commission" },
    { id: 131, input: "transfer charges 1500", expectedType: "expense", expectedAmount: 1500, expectedCategory: "expense", description: "Transfer charges" },
    { id: 132, input: "ATM charges 500", expectedType: "expense", expectedAmount: 500, expectedCategory: "expense", description: "ATM charges" },

    // Transport (6070)
    { id: 133, input: "transport fare 8000", expectedType: "expense", expectedAmount: 8000, expectedCategory: "transport", description: "Transport fare" },
    { id: 134, input: "bought fuel 25000", expectedType: "expense", expectedAmount: 25000, expectedCategory: "transport", description: "Fuel purchase" },
    { id: 135, input: "petrol 15000", expectedType: "expense", expectedAmount: 15000, expectedCategory: "transport", description: "Petrol" },
    { id: 136, input: "diesel 35000", expectedType: "expense", expectedAmount: 35000, expectedCategory: "transport", description: "Diesel" },
    { id: 137, input: "uber fare 3500", expectedType: "expense", expectedAmount: 3500, expectedCategory: "transport", description: "Uber" },
    { id: 138, input: "taxi 2000", expectedType: "expense", expectedAmount: 2000, expectedCategory: "transport", description: "Taxi" },
    { id: 139, input: "bolt 2500", expectedType: "expense", expectedAmount: 2500, expectedCategory: "transport", description: "Bolt" },

    // Interest Expense (6500-6510)
    { id: 140, input: "paid interest on loan 75000", expectedType: "expense", expectedAmount: 75000, expectedCategory: "expense", description: "Loan interest" },
    { id: 141, input: "bank interest charges 45000", expectedType: "expense", expectedAmount: 45000, expectedCategory: "expense", description: "Bank interest" },
    { id: 142, input: "interest expense 60000", expectedType: "expense", expectedAmount: 60000, expectedCategory: "expense", description: "Interest expense" },

    // Bad Debts (6040)
    { id: 143, input: "wrote off bad debt 50000", expectedType: "other", expectedAmount: 50000, expectedCategory: "other", description: "Bad debt writeoff" },
    { id: 144, input: "uncollectible receivable 35000", expectedType: "other", expectedAmount: 35000, expectedCategory: "other", description: "Uncollectible" },

    // ===== NIGERIAN-SPECIFIC PATTERNS =====

    { id: 145, input: "sold aso ebi 180000", expectedType: "sale", expectedAmount: 180000, expectedCategory: "sales", description: "Nigerian fabric sale" },
    { id: 146, input: "purchased ankara 95000", expectedType: "purchase", expectedAmount: 95000, expectedCategory: "purchases", description: "Fabric purchase" },
    { id: 147, input: "paid agbero 2000", expectedType: "expense", expectedAmount: 2000, expectedCategory: "transport", description: "Local transport levy" },
    { id: 148, input: "paid area boys 1500", expectedType: "expense", expectedAmount: 1500, expectedCategory: "expense", description: "Local expense" },
    { id: 149, input: "keke napep 500", expectedType: "expense", expectedAmount: 500, expectedCategory: "transport", description: "Tricycle fare" },
    { id: 150, input: "danfo 200", expectedType: "expense", expectedAmount: 200, expectedCategory: "transport", description: "Bus fare" },
    { id: 151, input: "bought suya 5000", expectedType: "expense", expectedAmount: 5000, expectedCategory: "expense", description: "Food expense" },
    { id: 152, input: "naira 50000 sales", expectedType: "sale", expectedAmount: 50000, expectedCategory: "sales", description: "Currency prefix" },
    { id: 153, input: "50k sales", expectedType: "sale", expectedAmount: 50000, expectedCategory: "sales", description: "K notation" },
    { id: 154, input: "2m loan received", expectedType: "loan", expectedAmount: 2000000, expectedCategory: "loan", description: "M notation" },

    // ===== EDGE CASES & COMPLEX PATTERNS =====

    { id: 155, input: "sold goods worth ₦250,000", expectedType: "sale", expectedAmount: 250000, expectedCategory: "sales", description: "Naira symbol with comma" },
    { id: 156, input: "NGN 150000 received", expectedType: "receipt", expectedAmount: 150000, expectedCategory: "income", description: "NGN prefix" },
    { id: 157, input: "paid 500000 for generator", expectedType: "asset", expectedAmount: 500000, expectedCategory: "asset", description: "Asset with amount first" },
    { id: 158, input: "bought 3 laptops 450000", expectedType: "asset", expectedAmount: 450000, expectedCategory: "asset", description: "Multiple units asset" },
    { id: 159, input: "sold on credit to customer 200000", expectedType: "sale", expectedAmount: 200000, expectedCategory: "sales", description: "Credit sale explicit" },
    { id: 160, input: "paid cash 75000 for stock", expectedType: "purchase", expectedAmount: 75000, expectedCategory: "purchases", description: "Cash purchase method" },

    // Transfer between accounts
    { id: 161, input: "transfer from savings to current 100000", expectedType: "transfer", expectedAmount: 100000, expectedCategory: "transfer", description: "Inter-account transfer" },
    { id: 162, input: "moved money to another account 500000", expectedType: "transfer", expectedAmount: 500000, expectedCategory: "transfer", description: "Money movement" },

    // Returns
    { id: 163, input: "returned goods to supplier 45000", expectedType: "other", expectedAmount: 45000, expectedCategory: "other", description: "Purchase return" },
    { id: 164, input: "received returned items from customer 30000", expectedType: "other", expectedAmount: 30000, expectedCategory: "other", description: "Sales return received" },

    // Compound transactions
    { id: 165, input: "sold goods 500000 with VAT", expectedType: "sale", expectedAmount: 500000, expectedCategory: "sales", description: "Sale with VAT mention" },
    { id: 166, input: "purchased equipment 800000 including VAT", expectedType: "asset", expectedAmount: 800000, expectedCategory: "asset", description: "Asset with VAT" },

    // Informal language
    { id: 167, input: "got 50k from customer", expectedType: "receipt", expectedAmount: 50000, expectedCategory: "income", description: "Informal receipt" },
    { id: 168, input: "gave supplier 100k", expectedType: "payment", expectedAmount: 100000, expectedCategory: "supplier-payment", description: "Informal payment" },
    { id: 169, input: "income 350000", expectedType: "sale", expectedAmount: 350000, expectedCategory: "sales", description: "Simple income" },
    { id: 170, input: "expense 25000", expectedType: "expense", expectedAmount: 25000, expectedCategory: "expense", description: "Simple expense" },

    // POS transactions
    { id: 171, input: "POS sales 75000", expectedType: "sale", expectedAmount: 75000, expectedCategory: "sales", description: "POS sale" },
    { id: 172, input: "card payment received 120000", expectedType: "receipt", expectedAmount: 120000, expectedCategory: "income", description: "Card payment" },
    { id: 173, input: "paid via POS 45000", expectedType: "expense", expectedAmount: 45000, expectedCategory: "expense", description: "POS payment" },

    // Cheque transactions
    { id: 174, input: "received cheque 500000", expectedType: "receipt", expectedAmount: 500000, expectedCategory: "income", description: "Cheque received" },
    { id: 175, input: "paid by cheque 250000", expectedType: "payment", expectedAmount: 250000, expectedCategory: "expense", description: "Cheque payment" },

    // Direct entry format
    { id: 176, input: "debit bank 100000 credit sales", expectedType: "other", expectedAmount: 100000, expectedCategory: "direct-entry", description: "Direct debit/credit" },
    { id: 177, input: "dr cash cr capital 5000000", expectedType: "other", expectedAmount: 5000000, expectedCategory: "direct-entry", description: "DR/CR shorthand" },

    // More product purchases
    { id: 178, input: "purchase hair extensions 150000", expectedType: "purchase", expectedAmount: 150000, expectedCategory: "purchases", description: "Hair product purchase" },
    { id: 179, input: "bought cosmetics 80000", expectedType: "purchase", expectedAmount: 80000, expectedCategory: "purchases", description: "Cosmetics purchase" },
    { id: 180, input: "purchased clothing 200000", expectedType: "purchase", expectedAmount: 200000, expectedCategory: "purchases", description: "Clothing purchase" },
    { id: 181, input: "bought electronics 350000", expectedType: "purchase", expectedAmount: 350000, expectedCategory: "purchases", description: "Electronics purchase" },
    { id: 182, input: "purchased food items 45000", expectedType: "purchase", expectedAmount: 45000, expectedCategory: "purchases", description: "Food items purchase" },
    { id: 183, input: "bought drinks 25000", expectedType: "purchase", expectedAmount: 25000, expectedCategory: "purchases", description: "Drinks purchase" },
    { id: 184, input: "purchased accessories 60000", expectedType: "purchase", expectedAmount: 60000, expectedCategory: "purchases", description: "Accessories purchase" },
    { id: 185, input: "bought shoes 35000", expectedType: "purchase", expectedAmount: 35000, expectedCategory: "purchases", description: "Shoes purchase" },

    // More sales patterns
    { id: 186, input: "sold shoes 45000", expectedType: "sale", expectedAmount: 45000, expectedCategory: "sales", description: "Shoes sale" },
    { id: 187, input: "sold bags 120000", expectedType: "sale", expectedAmount: 120000, expectedCategory: "sales", description: "Bags sale" },
    { id: 188, input: "sold drinks 15000", expectedType: "sale", expectedAmount: 15000, expectedCategory: "sales", description: "Drinks sale" },
    { id: 189, input: "sold phone 85000", expectedType: "sale", expectedAmount: 85000, expectedCategory: "sales", description: "Phone sale" },
    { id: 190, input: "sold jewelry 250000", expectedType: "sale", expectedAmount: 250000, expectedCategory: "sales", description: "Jewelry sale" },

    // Miscellaneous
    { id: 191, input: "donation 50000", expectedType: "expense", expectedAmount: 50000, expectedCategory: "expense", description: "Donation" },
    { id: 192, input: "fine paid 25000", expectedType: "expense", expectedAmount: 25000, expectedCategory: "expense", description: "Fine payment" },
    { id: 193, input: "license fee 100000", expectedType: "expense", expectedAmount: 100000, expectedCategory: "expense", description: "License fee" },
    { id: 194, input: "registration fee 35000", expectedType: "expense", expectedAmount: 35000, expectedCategory: "expense", description: "Registration" },
    { id: 195, input: "subscription 15000", expectedType: "expense", expectedAmount: 15000, expectedCategory: "expense", description: "Subscription" },
    { id: 196, input: "commission earned 75000", expectedType: "receipt", expectedAmount: 75000, expectedCategory: "income", description: "Commission income" },
    { id: 197, input: "paid commission 50000", expectedType: "expense", expectedAmount: 50000, expectedCategory: "expense", description: "Commission paid" },
    { id: 198, input: "security deposit 200000", expectedType: "expense", expectedAmount: 200000, expectedCategory: "expense", description: "Security deposit" },
    { id: 199, input: "caution fee 50000", expectedType: "expense", expectedAmount: 50000, expectedCategory: "expense", description: "Caution fee" },
    { id: 200, input: "agreement fee 30000", expectedType: "expense", expectedAmount: 30000, expectedCategory: "expense", description: "Agreement fee" },
];

// ============================================================================
// TEST RUNNER
// ============================================================================

function runTests(): { passed: number; failed: number; accuracy: number; failures: { id: number; input: string; expected: string; got: string; description: string }[] } {
    let passed = 0;
    let failed = 0;
    const failures: { id: number; input: string; expected: string; got: string; description: string }[] = [];

    for (const tc of testCases) {
        const result = parseTransactionFromChat(tc.input);

        if (!result) {
            failed++;
            failures.push({
                id: tc.id,
                input: tc.input,
                expected: `type=${tc.expectedType}, amount=${tc.expectedAmount}, category=${tc.expectedCategory}`,
                got: "null (failed to parse)",
                description: tc.description,
            });
            continue;
        }

        // Check amount
        const amountMatch = result.amount === tc.expectedAmount;

        // Check type (with some flexibility for similar types)
        const typeMatch = result.parsedType === tc.expectedType ||
            (tc.expectedType === 'sale' && ['sale', 'receipt'].includes(result.parsedType)) ||
            (tc.expectedType === 'receipt' && ['sale', 'receipt'].includes(result.parsedType)) ||
            (tc.expectedType === 'expense' && ['expense', 'payment'].includes(result.parsedType)) ||
            (tc.expectedType === 'payment' && ['expense', 'payment'].includes(result.parsedType));

        // Check category (with flexibility)
        const categoryMatch = result.category === tc.expectedCategory ||
            result.category?.includes(tc.expectedCategory) ||
            tc.expectedCategory.includes(result.category || '');

        if (amountMatch && (typeMatch || categoryMatch)) {
            passed++;
        } else {
            failed++;
            failures.push({
                id: tc.id,
                input: tc.input,
                expected: `type=${tc.expectedType}, amount=${tc.expectedAmount}, category=${tc.expectedCategory}`,
                got: `type=${result.parsedType}, amount=${result.amount}, category=${result.category}`,
                description: tc.description,
            });
        }
    }

    const accuracy = (passed / testCases.length) * 100;

    return { passed, failed, accuracy, failures };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

console.log("=".repeat(80));
console.log("TRANSACTION PARSER ACCURACY TEST");
console.log("=".repeat(80));
console.log(`Total test cases: ${testCases.length}`);
console.log("");

const results = runTests();

console.log(`RESULTS:`);
console.log(`  Passed: ${results.passed}`);
console.log(`  Failed: ${results.failed}`);
console.log(`  Accuracy: ${results.accuracy.toFixed(2)}%`);
console.log("");

if (results.failures.length > 0) {
    console.log("FAILURES:");
    console.log("-".repeat(80));
    for (const f of results.failures.slice(0, 50)) { // Show first 50 failures
        console.log(`[${f.id}] "${f.input}"`);
        console.log(`   Expected: ${f.expected}`);
        console.log(`   Got:      ${f.got}`);
        console.log(`   Desc:     ${f.description}`);
        console.log("");
    }

    if (results.failures.length > 50) {
        console.log(`... and ${results.failures.length - 50} more failures`);
    }
}

console.log("=".repeat(80));
console.log(`TARGET: 90% accuracy | CURRENT: ${results.accuracy.toFixed(2)}%`);
console.log(results.accuracy >= 90 ? "✅ TARGET MET!" : "❌ BELOW TARGET - IMPROVEMENTS NEEDED");
console.log("=".repeat(80));

// Export for use in other tests
export { testCases, runTests };
