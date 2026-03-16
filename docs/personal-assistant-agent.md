# Personal Assistant MCP Agent

This MCP server provides a personal assistant toolset for:
- scheduling meetings,
- creating/editing Google Docs,
- reading and replying to emails,
- generating daily briefs.

## Tool Surface (Skills)

1. `schedule_meeting`
2. `create_doc`
3. `edit_doc`
4. `read_inbox`
5. `draft_email_reply`
6. `send_email`
7. `generate_brief`
8. `send_brief_email`

## Required Environment Variables

Add these in your `.env.local` (or `.env`) file:

```bash
# Google Workspace OAuth
GOOGLE_ACCESS_TOKEN=
# Optional but recommended for automatic refresh:
GOOGLE_REFRESH_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# OpenAI (used for draft quality and brief synthesis)
OPENAI_API_KEY=
PERSONAL_ASSISTANT_MODEL=gpt-4.1-mini
```

## Required Google API Scopes

When generating OAuth credentials, include these scopes:

- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`

## Run

```bash
npm run mcp:assistant
```

## Notes

- `draft_email_reply` and `generate_brief` use OpenAI when `OPENAI_API_KEY` is set; otherwise they fall back to deterministic templates.
- Mutating tools (`schedule_meeting`, `create_doc`, `edit_doc`, `send_email`, `send_brief_email`) are intentionally marked non-idempotent in tool metadata.
