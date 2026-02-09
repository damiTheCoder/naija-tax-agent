# Quantum Ledger Skills for Clawdbot

This directory contains Clawdbot-compatible skill definitions that enable natural language interaction with Quantum Ledger accounting features.

## Installation

1. Copy this folder to your Clawdbot skills directory:
   ```bash
   cp -r ./cashos_skills ~/clawd/skills/cashos
   ```

2. Restart Clawdbot:
   ```bash
   clawdbot daemon restart
   ```

## Available Tools

| Tool | Description |
|------|-------------|
| `cashos_record_transaction` | Record income/expense transactions |
| `cashos_get_report` | Generate financial reports (P&L, Balance Sheet) |
| `cashos_compute_tax` | Calculate Nigerian taxes (VAT, WHT, CIT) |
| `cashos_get_cashflow` | Get cashflow metrics (burn rate, runway) |
| `cashos_validate_transaction` | Validate transaction classifications |

## Configuration

Set these environment variables in your Clawdbot config:

```yaml
# ~/clawd/config.yaml
tools:
  cashos:
    base_url: "http://localhost:3000"  # Your Quantum Ledger instance
    api_key: ""  # Optional: For authenticated endpoints
```
