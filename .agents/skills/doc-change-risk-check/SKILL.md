---
name: doc-change-risk-check
description: Use before or after major requirement-doc updates to evaluate regression risk, hidden coupling, and rollout impact. Do not use for implementation-only bugfixes.
---

# Doc Change Risk Check

## Goal
Evaluate requirement-document change risk before downstream implementation diverges.

## Workflow
1. Identify changed requirement areas and intended outcomes.
2. Map impacted documents and cross-references.
3. Assess risk categories: scope drift, dependency drift, naming drift, and decision drift.
4. Recommend mitigations and verification checks.
5. Produce a go/no-go readiness summary.

## Output
Return:
- Risk summary
- High-risk mismatches
- Recommended mitigations
- Readiness verdict

## Resources
- Use `references/risk-categories.md` for standard risk framing.
