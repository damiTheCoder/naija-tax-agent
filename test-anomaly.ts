import { accountingEngine } from './lib/accounting/transactionBridge';

accountingEngine.load();

// Clear existing state for clean test
const state = accountingEngine.getState();
state.journalEntries = [];
state.ledgerAccounts.forEach(acc => {
  acc.entries = [];
  acc.closingBalance = 0;
});

// Seed 5 months of normal AWS spend at ~₦100,000/mo
console.log("Seeding normal historical data...");
for (let i = 5; i > 0; i--) {
  const dateObj = new Date();
  dateObj.setMonth(dateObj.getMonth() - i);
  const dateStr = dateObj.toISOString().split("T")[0];
  
  accountingEngine.processTransactionEnhanced({
    id: `hist-${i}`,
    date: dateStr,
    description: "AWS Cloud Hosting",
    amount: -100000 + (Math.random() * 5000), // Minor variance
    type: "expense",
    category: "software"
  });
}

// Now process a sudden spike expense this month
console.log("\nProcessing anomaly transaction...");
const result = accountingEngine.processTransactionEnhanced({
  id: `curr-0`,
  date: new Date().toISOString().split("T")[0],
  description: "AWS Cloud Hosting - Database Scaling",
  amount: -450000, // Massive spike
  type: "expense",
  category: "software"
});

console.log("\nResulting Entry Anomaly Flag:");
console.log(result.journalEntry.anomalyFlag || "None");

// Test Batch Processing
console.log("\nTesting Batch Processor...");
const drafted = accountingEngine.processBatchIntelligently([
  {
    id: "batch-1",
    date: new Date().toISOString().split("T")[0],
    description: "Uber Ride to Airport",
    amount: -12000,
    type: "expense",
    category: "transport"
  },
  {
    id: "batch-2",
    date: new Date().toISOString().split("T")[0],
    description: "Stripe Payout",
    amount: 1500000,
    type: "income",
    category: "sales"
  }
]);

console.log("\nDrafted Entries:");
console.log(`Count: ${drafted.length}`);
console.log(`Status of first entry: ${drafted[0].status}`);
console.log(`Account assigned to first entry: ${drafted[0].lines[0].accountName}`);
