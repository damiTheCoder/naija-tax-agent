# Tax Compliance Engine Demo Walkthrough

## 1) Run the demo script (CLI)
```bash
cd naija-tax-agent
npx tsx scripts/tax-demo.ts
```
This uses `data/tax/demo-transactions.json` to generate schedules and issues.

## 2) UI walkthrough (Tax Workspace)
1. Open **Tax Workspace** in the UI.
2. Click **Run Computation**.
3. Review the **Overview** cards (VAT/WHT/CIT/CGT/Stamp).
4. Go to **Issues** to see any missing metadata or reconciliation errors.
5. Open **Schedules** and click **Download PDF** or **Export CSV**.
6. In **Filing & Payments**, change a schedule status (Draft → Filed).
7. Check **Audit & Documents** to verify logs and filing packs were recorded.

## 3) Tax Agent Chat
Try messages like:
- “Run tax computation for 2026-Q1”
- “Generate VAT schedule for 2026-Q1”
- “List issues for 2026-Q1”
- “Generate filing pack VAT 2026-Q1 as PDF”
- “Reconcile VAT 2026-Q1”

These trigger internal compliance functions with audit logging.
