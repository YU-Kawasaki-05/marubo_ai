---
name: gh-fix-ci
description: Use when a user asks to investigate or fix failing GitHub PR checks using gh CLI, including summarizing failing jobs and proposing a concrete fix plan.
---

# GH Fix CI

## Goal
Diagnose failing GitHub checks efficiently and move to a fix plan.

## Workflow
1. Resolve target PR (current branch PR by default).
2. Collect failing checks and details URLs.
3. Summarize probable failure causes and affected areas.
4. Build a minimal fix plan.
5. Implement only after explicit user approval.
6. Re-check status and summarize residual risks.

## Output
Return:
- Failing checks summary
- Probable root causes
- Proposed fix plan
- Verification status after fixes

## Resources
- Use `scripts/collect_failed_checks.py` to inspect failing checks quickly.
- Use `references/ci-playbook.md` for triage steps.
