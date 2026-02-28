This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## MCP + Gemini Bridge (Chat Modal Access)

This app now supports an MCP bridge path inside the existing chat modal flow.
The user entry point remains the chat modal, and `/api/agent/execute` routes
through MCP + Gemini first, with fallback to the legacy orchestrator.

### What is included

- MCP server tool layer: `lib/mcp/financialServer.ts`
- Gemini bridge client + tool orchestration: `lib/mcp/geminiBridge.ts`
- Human approval token flow for ledger posting: `lib/mcp/approvalStore.ts`
- Standalone MCP stdio server script: `scripts/mcp-financial-server.ts`
- MCP settings sample: `docs/mcp-settings.sample.json`

### Environment variables

Set one of:

- `GEMINI_API_KEY`
- `GOOGLE_GEMINI_API_KEY`
- `GOOGLE_API_KEY`

Optional:

- `MCP_AGENT_ENABLED=true` (default `true`)
- `GOOGLE_GEMINI_MODEL=gemini-2.5-flash` (or your preferred Gemini 2/3 model)

### Run MCP server directly

```bash
npm run mcp:server
```

### Human-in-the-loop approval

Sensitive ledger posting is gated. The bridge returns an approval token and
asks for confirmation. The user approves in chat with:

```text
approve ledger LEDGER-XXXXXX
```
