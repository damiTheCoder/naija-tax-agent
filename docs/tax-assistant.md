# Tax Assistant Chatbot

The in-app tax assistant helps practitioners understand calculations, inputs, overrides, and PDF details directly from the NaijaTaxAgent UI.

## Architecture

- **Knowledge Base**: `lib/agent/knowledge.ts` summarises PIT/CIT logic, VAT/WHT behaviour, levies, CGT/TET/stamp duties, PDF audit trails, and live rule overrides.
- **Retrieval Helper**: `lib/agent/rag.ts` scores knowledge entries using simple keyword matching and builds context snippets for the model.
- **API Route**: `app/api/agent/route.ts` accepts chat messages, retrieves relevant context, and (optionally) calls OpenAI’s Chat Completions API. When `OPENAI_API_KEY` is not configured the route falls back to deterministic answers sourced from the knowledge base.
- **UI Widget**: `components/TaxAgentChat.tsx` renders a floating assistant panel on every page via a dynamic import in `app/page.tsx`.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Optional. Enables real LLM responses via OpenAI-compatible Chat Completions. |
| `OPENAI_MODEL` | Optional. Defaults to `gpt-4o-mini`. |
| `OPENAI_API_BASE` | Optional base URL for compatible APIs. |

If no API key is present, the assistant will still respond using the curated knowledge summaries so practitioners always get contextual guidance.

## Extending the Knowledge Base

Add or update entries in `lib/agent/knowledge.ts` whenever you introduce new calculators or compliance workflows. Use concise summaries, detailed guidance, and include file paths in the `sources` array so responses can cite the relevant modules.

## Updating Tax Rules Context

Because the assistant reads from the same live tax-rule overrides (`lib/taxRules/liveRates.ts`) that power the calculator, answers will always mention the active rule version and source, keeping practitioners aligned with the calculations displayed in the UI and PDFs.
