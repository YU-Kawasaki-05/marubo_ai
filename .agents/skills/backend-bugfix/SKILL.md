---
name: backend-bugfix
description: Use for backend bug fixes with clear repro steps, failing tests, or production bug reports. Do not use for broad refactors or greenfield feature design.
---

# Backend Bugfix

## Goal
Fix backend bugs with the smallest defensible change.

## Workflow
1. Confirm or restate repro steps.
2. Identify the most likely root cause.
3. Make the smallest change that fixes the issue.
4. Run the relevant verification flow.
5. Add or update tests when practical.
6. Summarize changed files, risks, and anything not verified.

## Output
Return:
- Root cause
- Fix summary
- Files changed
- Verification performed
- Remaining risks

## Resources
- Use `references/test-policy.md` for verification expectations.
- Use `scripts/verify.sh` for the default verification command when it fits the repo.
