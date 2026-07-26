---
name: connect-actions
description: Use when the user wants Codex to take real actions via external app/connectors (mail, chat, tickets, docs). Use only with explicit user intent and confirm destructive actions.
---

# Connect Actions

## Goal
Execute real-world actions through connected tools instead of only drafting text.

## Workflow
1. Confirm the target action and destination system.
2. Check connector availability and permissions.
3. Draft exact action payload and ask for final confirmation for destructive operations.
4. Execute through the connector.
5. Return action result and traceable confirmation details.

## Output
Return:
- Action requested
- System used
- Execution result
- Follow-up checks

## Safety
- Require explicit user confirmation before delete/update operations.
- Prefer dry-run style previews when available.
