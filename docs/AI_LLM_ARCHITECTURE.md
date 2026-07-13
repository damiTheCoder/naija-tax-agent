# AI LLM Architecture Diagnosis

The intended structure is:

```text
App Core
  -> LLM Service Interface
  -> AI Provider Wrapper
  -> AI API
```

## Current Diagnosis

The current AI experience feels rigid because the app still has multiple AI paths and too much logic inside the chat surface.

- `components/FloatingChatButton.tsx` mixes UI rendering, conversation persistence, route changes, tool execution, local fast paths, background execution, and agent state. This makes the chat behave like a command panel instead of a fluid AI surface.
- `/api/agent` and `/api/agent/execute` are separate model paths. `/api/agent` builds Gemini prompts directly, while `/api/agent/execute` goes through MCP/orchestrator logic. This creates inconsistent tone, latency, and behavior.
- `lib/agent/aiService.ts` was coupled to `GeminiClient`, so provider behavior leaked into planner logic.
- The orchestrator uses many deterministic regex routes before or around the LLM. Those are useful guardrails, but they currently dominate the experience and make the assistant feel scripted.
- The UI appends generic completion messages such as `Completed in background.` and `Request complete.` after assistant replies. That makes responses feel mechanical.
- Responses are mostly single-turn request/response. There is limited explicit state for intent, plan, tool observations, draft answer, final answer, and follow-up suggestions.

## First Structural Fix Added

The project now has a provider-agnostic LLM layer:

```text
lib/llm/types.ts
lib/llm/service.ts
lib/llm/providers/geminiProvider.ts
lib/llm/index.ts
```

`lib/agent/aiService.ts` now depends on `LLMServiceInterface`, not a Gemini-specific client. Gemini is now just one provider wrapper behind the LLM service.

## Runtime Pipeline Added

The agent execution endpoint now goes through `lib/agent/runtime.ts`.

The runtime preserves the old response shape:

```ts
{ reply, actions, confidence, reasoning, planSource }
```

and adds richer AI-app metadata:

```ts
{
  phases: [
    { name: "understanding", status, summary },
    { name: "plan", status, summary },
    { name: "observations", status, summary },
    { name: "answer", status, summary },
    { name: "suggestions", status, summary }
  ],
  suggestions: ["Show me what changed", "Show the audit trail"]
}
```

This means the UI can show a premium AI flow without changing the planner contract: understand the request, plan, observe tool results, answer naturally, then suggest the next best actions.

## Chat UX Change Added

The chat UI now preserves runtime `suggestions` and renders them as quick action chips below assistant replies.

This removes some rigidity from the flow:

- The assistant no longer appends generic completion filler after every successful action.
- Follow-up actions are contextual chips, not extra bot messages.
- The response can stay conversational while still nudging the user toward the next useful step.

## Target Next Refactor

The next pass should consolidate chat into a single pipeline:

```text
Chat UI
  -> Conversation Controller
  -> Agent Runtime
  -> LLM Service Interface
  -> Provider Wrapper
  -> Gemini/OpenAI/etc API
```

The runtime should return structured phases:

- `understanding`: normalized user intent and missing info.
- `plan`: candidate actions and data lookups.
- `observations`: tool results and context used.
- `answer`: final human response.
- `suggestions`: short next-step chips.

This will let the UI feel more like a top AI app: fast acknowledgement, visible thinking/progress states, natural final answer, and contextual next steps without hardcoded filler.
