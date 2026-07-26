# CI Playbook

1. Confirm authentication: `gh auth status`.
2. Resolve PR: `gh pr view --json number,url`.
3. List checks: `gh pr checks <pr> --json name,state,bucket,link`.
4. For failing GitHub Actions jobs, inspect run details with `gh run view`.
5. Propose smallest defensible fix and verify with targeted tests.
