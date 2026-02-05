/**
 * Transaction Parsing Test Suite
 * Tests the AI validation layer with 100 common Nigerian business transactions
 */

const TEST_TRANSACTIONS = [
    // === SUPPLIER / CREDITOR PAYMENTS ===
    { input: "paid suppliers 5000 naira cash", expected: { dr: "2000", cr: "1000" } },
    { input: "paid creditors 10000", expected: { dr: "2000", cr: "1020" } },
    { input: "paid vendor for goods 25000", expected: { dr: "2000", cr: "1020" } },
    { input: "settled suppliers account 50000", expected: { dr: "2000", cr: "1020" } },
    { input: "payment to creditor for supplies 15000", expected: { dr: "2000", cr: "1020" } },

    // === SUPPLIER REFUNDS (Money received FROM creditors) ===
    { input: "received money from creditors 5600", expected: { dr: "1020", cr: "2000" } },
    { input: "refund from supplier 3000", expected: { dr: "1020", cr: "2000" } },
    { input: "supplier returned our overpayment 8000", expected: { dr: "1020", cr: "2000" } },

    // === CUSTOMER PAYMENTS (Money from debtors) ===
    { input: "received from customer 50000", expected: { dr: "1020", cr: "1100" } },
    { input: "customer paid account 25000", expected: { dr: "1020", cr: "1100" } },
    { input: "debtor settled balance 15000", expected: { dr: "1020", cr: "1100" } },
    { input: "collected from debtors 100000", expected: { dr: "1020", cr: "1100" } },

    // === CASH SALES ===
    { input: "sold goods for cash 50000", expected: { dr: "1020", cr: "4000" } },
    { input: "cash sale 30000 naira", expected: { dr: "1020", cr: "4000" } },
    { input: "sold merchandise 75000", expected: { dr: "1020", cr: "4000" } },
    { input: "sales of goods 45000", expected: { dr: "1020", cr: "4000" } },
    { input: "revenue from sales 80000", expected: { dr: "1020", cr: "4000" } },

    // === CREDIT SALES ===
    { input: "sold goods on credit 100000", expected: { dr: "1100", cr: "4000" } },
    { input: "credit sale to customer 60000", expected: { dr: "1100", cr: "4000" } },
    { input: "sold on account 35000", expected: { dr: "1100", cr: "4000" } },

    // === CASH PURCHASES ===
    { input: "bought goods for resale 50000 cash", expected: { dr: "5010", cr: "1000" } },
    { input: "purchased inventory 80000", expected: { dr: "5010", cr: "1020" } },
    { input: "cash purchase of stock 25000", expected: { dr: "5010", cr: "1020" } },
    { input: "bought raw materials 40000", expected: { dr: "5010", cr: "1020" } },

    // === CREDIT PURCHASES ===
    { input: "bought goods on credit 60000", expected: { dr: "5010", cr: "2000" } },
    { input: "purchased inventory on account 45000", expected: { dr: "5010", cr: "2000" } },
    { input: "credit purchase of stocks 35000", expected: { dr: "5010", cr: "2000" } },

    // === EXPENSE PAYMENTS ===
    { input: "paid rent 150000", expected: { dr: "5600", cr: "1020" } },
    { input: "paid salaries 500000", expected: { dr: "5500", cr: "1020" } },
    { input: "paid NEPA bill 25000", expected: { dr: "5610", cr: "1020" } },
    { input: "electricity bill 18000", expected: { dr: "5610", cr: "1020" } },
    { input: "paid MTN airtime 5000", expected: { dr: "5620", cr: "1020" } },
    { input: "fuel expense 15000", expected: { dr: "6070", cr: "1020" } },
    { input: "transport fare 3000", expected: { dr: "6070", cr: "1020" } },
    { input: "uber trip 2500", expected: { dr: "6070", cr: "1020" } },
    { input: "paid lawyer fees 100000", expected: { dr: "5920", cr: "1020" } },
    { input: "legal fees 50000", expected: { dr: "5920", cr: "1020" } },
    { input: "audit fees 200000", expected: { dr: "5910", cr: "1020" } },
    { input: "paid for advertising 75000", expected: { dr: "6000", cr: "1020" } },
    { input: "marketing expense 40000", expected: { dr: "6000", cr: "1020" } },
    { input: "entertainment expense 20000", expected: { dr: "6010", cr: "1020" } },
    { input: "staff welfare 10000", expected: { dr: "5510", cr: "1020" } },
    { input: "training cost 35000", expected: { dr: "6020", cr: "1020" } },
    { input: "bank charges 500", expected: { dr: "6030", cr: "1020" } },
    { input: "ATM charge 100", expected: { dr: "6030", cr: "1020" } },
    { input: "COT charges 1500", expected: { dr: "6030", cr: "1020" } },
    { input: "insurance premium 80000", expected: { dr: "5800", cr: "1020" } },
    { input: "repair and maintenance 25000", expected: { dr: "5810", cr: "1020" } },
    { input: "office supplies 8000", expected: { dr: "5820", cr: "1020" } },
    { input: "stationery 3500", expected: { dr: "5820", cr: "1020" } },
    { input: "internet subscription 15000", expected: { dr: "5620", cr: "1020" } },
    { input: "DSTV subscription 24000", expected: { dr: "6010", cr: "1020" } },

    // === ASSET PURCHASES ===
    { input: "bought computer 250000", expected: { dr: "1560", cr: "1020" } },
    { input: "purchased laptop 180000", expected: { dr: "1560", cr: "1020" } },
    { input: "bought vehicle 5000000", expected: { dr: "1530", cr: "1020" } },
    { input: "purchased motor vehicle 8000000", expected: { dr: "1530", cr: "1020" } },
    { input: "bought furniture 150000", expected: { dr: "1550", cr: "1020" } },
    { input: "office equipment 85000", expected: { dr: "1540", cr: "1020" } },
    { input: "purchased machinery 2500000", expected: { dr: "1520", cr: "1020" } },
    { input: "land purchase 50000000", expected: { dr: "1500", cr: "1020" } },
    { input: "bought building 100000000", expected: { dr: "1510", cr: "1020" } },

    // === LOAN TRANSACTIONS ===
    { input: "received bank loan 5000000", expected: { dr: "1020", cr: "2500" } },
    { input: "borrowed from bank 2000000", expected: { dr: "1020", cr: "2500" } },
    { input: "loan repayment 100000", expected: { dr: "2500", cr: "1020" } },
    { input: "paid loan installment 250000", expected: { dr: "2500", cr: "1020" } },

    // === CAPITAL / EQUITY ===
    { input: "owner invested capital 1000000", expected: { dr: "1020", cr: "3000" } },
    { input: "capital injection 5000000", expected: { dr: "1020", cr: "3000" } },
    { input: "owner withdrawal 200000", expected: { dr: "3200", cr: "1020" } },
    { input: "drawings 150000", expected: { dr: "3200", cr: "1020" } },

    // === TAX PAYMENTS ===
    { input: "paid VAT 75000", expected: { dr: "2200", cr: "1020" } },
    { input: "remitted PAYE 45000", expected: { dr: "2210", cr: "1020" } },
    { input: "paid withholding tax 30000", expected: { dr: "2220", cr: "1020" } },
    { input: "pension contribution 80000", expected: { dr: "2230", cr: "1020" } },

    // === INCOME (Non-sales) ===
    { input: "interest received 15000", expected: { dr: "1020", cr: "4200" } },
    { input: "dividend income 50000", expected: { dr: "1020", cr: "4210" } },
    { input: "rental income 200000", expected: { dr: "1020", cr: "4220" } },

    // === PREPAID EXPENSES ===
    { input: "prepaid rent 600000", expected: { dr: "1310", cr: "1020" } },
    { input: "prepaid insurance 120000", expected: { dr: "1320", cr: "1020" } },

    // === BAD DEBTS ===
    { input: "wrote off bad debt 25000", expected: { dr: "6040", cr: "1100" } },
    { input: "bad debts expense 50000", expected: { dr: "6040", cr: "1100" } },

    // === DONATIONS ===
    { input: "donated to charity 100000", expected: { dr: "6050", cr: "1020" } },
    { input: "charitable donation 50000", expected: { dr: "6050", cr: "1020" } },

    // === FINES / PENALTIES ===
    { input: "paid penalty 20000", expected: { dr: "6060", cr: "1020" } },
    { input: "fine for late filing 15000", expected: { dr: "6060", cr: "1020" } },

    // === TRANSFERS ===
    { input: "transferred to savings 500000", expected: { dr: "1021", cr: "1020" } },
    { input: "bank to bank transfer 200000", expected: { dr: "1020", cr: "1020" } },

    // === SERVICE REVENUE ===
    { input: "consulting fee received 150000", expected: { dr: "1020", cr: "4010" } },
    { input: "professional services income 80000", expected: { dr: "1020", cr: "4010" } },
];

async function runTests() {
    console.log('🧪 Starting Transaction Parsing Test Suite...\n');
    console.log(`Testing ${TEST_TRANSACTIONS.length} transactions\n`);

    let passed = 0;
    let failed = 0;
    const failures: { input: string; expected: { dr: string; cr: string }; actual: { dr: string; cr: string } }[] = [];

    for (const test of TEST_TRANSACTIONS) {
        try {
            const response = await fetch('http://localhost:3000/api/accounting/validate-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionText: test.input,
                    amount: parseInt(test.input.match(/\d+/)?.[0] || '1000')
                })
            });

            const data = await response.json();

            if (data.success && data.result) {
                const dr = data.result.debitAccount?.code || 'NONE';
                const cr = data.result.creditAccount?.code || 'NONE';

                if (dr === test.expected.dr && cr === test.expected.cr) {
                    passed++;
                    console.log(`✅ PASS: "${test.input.substring(0, 40)}..." → DR:${dr} CR:${cr}`);
                } else {
                    failed++;
                    failures.push({ input: test.input, expected: test.expected, actual: { dr, cr } });
                    console.log(`❌ FAIL: "${test.input.substring(0, 40)}..."`);
                    console.log(`   Expected: DR:${test.expected.dr} CR:${test.expected.cr}`);
                    console.log(`   Actual:   DR:${dr} CR:${cr}`);
                }
            } else {
                failed++;
                console.log(`❌ ERROR: "${test.input}" - No result returned`);
            }

            // Small delay to not overwhelm the server
            await new Promise(r => setTimeout(r, 100));
        } catch (err) {
            failed++;
            console.log(`❌ ERROR: "${test.input}" - ${err}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 RESULTS: ${passed} passed, ${failed} failed out of ${TEST_TRANSACTIONS.length}`);
    console.log(`✓ Accuracy: ${((passed / TEST_TRANSACTIONS.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    if (failures.length > 0) {
        console.log('\n📋 FAILED TESTS:');
        failures.forEach((f, i) => {
            console.log(`\n${i + 1}. "${f.input}"`);
            console.log(`   Expected: DR:${f.expected.dr} CR:${f.expected.cr}`);
            console.log(`   Actual:   DR:${f.actual.dr} CR:${f.actual.cr}`);
        });
    }
}

runTests();
