---
name: requirements-sync
description: Use when requirements docs are edited and you need to validate cross-document consistency for FR/SCR/BR/U IDs and decision-log alignment. Do not use for code implementation tasks.
---

# Requirements Sync

## Goal
Keep requirement artifacts synchronized after documentation edits.

## Workflow
1. Identify changed requirement documents and affected sections.
2. Check ID consistency across `docs/01_要件定義/` and `docs/01_要件定義/wireframes/`.
3. Confirm screen transition references (`SCR-*`) and feature references (`FR-*`) are still aligned.
4. Check whether decision-level changes require updates in `docs/00_共通/決定事項ログ_decision-log.md`.
5. Report mismatches with file paths and exact IDs.
6. Propose minimal edits to restore consistency.

## Output
Return:
- Scope reviewed
- Inconsistencies found (ordered by risk)
- Required document updates
- Optional cleanup opportunities

## Resources
- Use `references/checklist.md` for sync criteria.
