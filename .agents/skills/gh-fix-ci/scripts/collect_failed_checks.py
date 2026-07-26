#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from pathlib import Path


def run(args, cwd):
    p = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
    return p.returncode, p.stdout, p.stderr


def resolve_pr(repo, pr):
    if pr:
        return str(pr)
    code, out, err = run(["gh", "pr", "view", "--json", "number"], repo)
    if code != 0:
        raise RuntimeError((err or out).strip() or "Failed to resolve PR")
    data = json.loads(out)
    return str(data["number"])


def is_fail(item):
    state = str(item.get("state", "")).lower()
    bucket = str(item.get("bucket", "")).lower()
    return state in {"fail", "failure", "error", "cancelled", "timed_out"} or bucket == "fail"


def main():
    parser = argparse.ArgumentParser(description="Collect failing checks for a PR")
    parser.add_argument("--repo", default=".", help="Repository path")
    parser.add_argument("--pr", default=None, help="PR number or URL")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    if not repo.exists():
        print("Repo path does not exist", file=sys.stderr)
        return 2

    try:
        pr = resolve_pr(repo, args.pr)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 2

    code, out, err = run(
        ["gh", "pr", "checks", pr, "--json", "name,state,bucket,link"],
        repo,
    )
    if code != 0:
        print((err or out).strip() or "Failed to fetch PR checks", file=sys.stderr)
        return 2

    checks = json.loads(out)
    failing = [c for c in checks if is_fail(c)]

    if args.json:
        print(json.dumps({"pr": pr, "failing": failing}, ensure_ascii=False, indent=2))
    else:
        print(f"PR #{pr}: {len(failing)} failing checks")
        for c in failing:
            name = c.get("name", "")
            state = c.get("state", "")
            link = c.get("link", "")
            print(f"- {name} [{state}] {link}")

    return 1 if failing else 0


if __name__ == "__main__":
    raise SystemExit(main())
