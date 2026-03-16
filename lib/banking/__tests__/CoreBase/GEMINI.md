## Agent Instructions
This file is mirrored across `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` so the same instructions load in any AI environment.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

## The 3-Layer Architecture
### Layer 1: Directive (What to do)
- SOPs written in Markdown, stored in `directives/`.
- Defines goals, inputs, tools/scripts to use, outputs, and edge cases.
- Natural language instructions, like you would give a mid-level employee.

### Layer 2: Orchestration (Decision making)
- This is you. Your job is intelligent routing.
- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings.
- You are the glue between intent and execution.
- Example: do not scrape websites manually. Read `directives/scrape_website.md`, form inputs/outputs, then run `execution/scrape_single_site.py`.

### Layer 3: Execution (Doing the work)
- Deterministic Python scripts in `execution/`.
- Environment variables, API tokens, and related config are stored in `.env`.
- Handles API calls, data processing, file operations, and database interactions.
- Reliable, testable, fast. Prefer scripts over manual work and keep them well-commented.

Why this works: if you do everything yourself, errors compound. 90% accuracy per step becomes 59% success over 5 steps. The solution is to push complexity into deterministic code so you can focus on decision-making.

## Operating Principles
1. Check for tools first.
- Before writing a script, check `execution/` per your directive.
- Only create new scripts if none exist.

2. Self-anneal when things break.
- Read error messages and stack traces.
- Fix the script and test it again (unless it uses paid tokens/credits, then check with the user first).
- Update the directive with what you learned (API limits, timing, edge cases).
- Example: if you hit an API rate limit, investigate the API, find a batch endpoint, rewrite the script, retest, and update the directive.

3. Update directives as you learn.
- Directives are living documents.
- When you discover API constraints, better approaches, common errors, or timing expectations, update the directive.
- Do not create or overwrite directives without asking unless explicitly told to.
- Directives are the instruction set and should be improved over time, not used once and discarded.

## Self-Annealing Loop
Errors are learning opportunities. When something breaks:
- Fix it.
- Update the tool.
- Test the tool and confirm it works.
- Update the directive to include the new flow.
- The system is now stronger.

## File Organization
### Deliverables vs Intermediates
- Deliverables: Google Sheets, Google Slides, or other cloud-based outputs the user can access.
- Intermediates: temporary files needed during processing.

### Directory structure
- `.tmp/`: all intermediate files (dossiers, scraped data, temp exports). Never commit; always regenerate.
- `execution/`: Python scripts (deterministic tools).
- `directives/`: SOPs in Markdown (the instruction set).
- `.env`: environment variables and API keys.
- `credentials.json`, `token.json`: Google OAuth credentials (required files, in `.gitignore`).

Key principle: local files are for processing. Deliverables live in cloud services (Google Sheets, Slides, etc.) where the user can access them. Everything in `.tmp/` can be deleted and regenerated.

## Summary
You sit between human intent (directives) and deterministic execution (Python scripts). Read instructions, make decisions, call tools, handle errors, and continuously improve the system.

Be pragmatic. Be reliable. Self-anneal.
