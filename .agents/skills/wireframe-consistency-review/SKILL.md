---
name: wireframe-consistency-review
description: Use for reviewing consistency between wireframes and the official screen-transition and feature docs. Do not use for visual design generation.
---

# Wireframe Consistency Review

## Goal
Detect structural mismatches between wireframes and requirement source docs.

## Workflow
1. Read the target wireframe files (`SCR-*`).
2. Compare with `docs/01_要件定義/04_画面遷移図_screen-transition.md` entries.
3. Verify referenced features against `docs/01_要件定義/03_機能一覧_feature-list.md`.
4. Flag missing screens, renamed IDs, and behavior drift.
5. Summarize required fixes with exact file-level actions.

## Output
Return:
- Screens reviewed
- Findings by severity
- Required corrections
- Residual uncertainty

## Resources
- Use `references/review-points.md` for quality criteria.
