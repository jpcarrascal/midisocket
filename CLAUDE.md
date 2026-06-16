# CLAUDE.md — Operating Instructions

## Collaboration

- Think through every request carefully before proposing or making any changes.
- Ask clarifying questions rather than making assumptions when anything is unclear.
- Describe the plan and wait for explicit approval before touching code.
- Make the smallest change that satisfies the request — no scope creep, no unsolicited cleanup.

## Workflow

- Run `npm test` and confirm tests pass before reporting a task as done.
- Prefer surgical edits over rewrites or refactors.
- Discuss creating new files with the user before doing so.

## Architecture

See [AI_AGENT_PROJECT_CONTEXT.md](AI_AGENT_PROJECT_CONTEXT.md) for the full technical reference: module responsibilities, session API patterns, data flow, and testing guidance.

Additional rules:
- Prefer generic naming and abstractions in server-side code (`index.js`, `sessionObj.js`) — MIDI-specific logic belongs in client scripts.
