---
name: pr-review
description: Use for pull request review, change review, regression scanning, or when the user asks for risks, missing tests, or code review feedback. Do not use for implementing new features.
---

# PR Review

## Goal
Review a proposed change with an emphasis on correctness, regressions, security, missing tests, and clarity.

## Workflow
1. Read the diff and identify the purpose of the change.
2. Check for correctness issues, broken assumptions, and hidden coupling.
3. Look for missing tests, especially around edge cases and error paths.
4. Check whether public behavior or contracts changed without documentation.
5. Produce findings ordered by severity.
6. If no issues are found, state what you checked.

## Output
Return:
- Summary of what changed
- Findings by severity
- Missing tests or coverage gaps
- Residual risks
- Final verdict

## Additional guidance
- Use `references/review-checklist.md` for detailed review prompts.
- Prefer concrete file-level findings over vague style commentary.
