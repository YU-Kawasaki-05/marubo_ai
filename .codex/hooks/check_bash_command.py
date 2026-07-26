#!/usr/bin/env python3
import json
import re
import shlex
import subprocess
import sys

FEATURE_BRANCH_PREFIX = "feature/"


def deny(reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def read_command() -> str:
    payload = json.load(sys.stdin)
    tool_input = payload.get("tool_input", {})
    if isinstance(tool_input, dict):
        return str(tool_input.get("command", "") or "")
    return str(tool_input or "")


def get_current_branch() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
            timeout=1.0,
        )
    except (subprocess.SubprocessError, FileNotFoundError):
        return ""
    branch = (result.stdout or "").strip()
    if branch in ("", "HEAD"):
        return ""
    return branch


def is_feature_branch(branch: str) -> bool:
    return bool(branch) and branch.startswith(FEATURE_BRANCH_PREFIX)


def looks_like_dangerous_rm(command_lower: str) -> bool:
    blocked_regexes = [
        r"\brm\s+-rf\s+/\s*$",
        r"\brm\s+-rf\s+/\*$",
        r"\brm\s+-rf\s+/\*\s",
        r"\bsudo\s+rm\s+-rf\s+/\s*$",
    ]
    return any(re.search(pattern, command_lower) for pattern in blocked_regexes)


def has_option(tokens: list[str], option: str) -> bool:
    return any(token == option for token in tokens)


def main() -> int:
    command = read_command()
    command_lower = command.lower()

    if looks_like_dangerous_rm(command_lower):
        deny("Blocked dangerous root delete pattern.")

    blocked_fragments = [
        "mkfs",
        ":(){ :|:& };:",
        "dd if=/dev/zero",
        "chmod -R 777 /",
    ]
    for fragment in blocked_fragments:
        if fragment in command_lower:
            deny(f"Blocked dangerous command fragment: {fragment}")

    try:
        argv = shlex.split(command)
    except ValueError:
        argv = []

    if len(argv) >= 3 and argv[0] == "git" and argv[1] == "reset" and has_option(argv[2:], "--hard"):
        deny("`git reset --hard` is blocked because it discards uncommitted changes.")

    if len(argv) >= 3 and argv[0] == "git" and argv[1] == "clean" and any(opt in {"-fdx", "-xdf", "-fxd"} for opt in argv[2:]):
        deny("`git clean -fdx` is blocked because it deletes untracked and ignored files.")

    if len(argv) >= 2 and argv[0] == "git" and argv[1] == "push":
        deny("`git push` is human-only in this repository. Ask a human to push from the terminal.")

    if len(argv) >= 2 and argv[0] == "git" and argv[1] == "commit":
        current_branch = get_current_branch()
        if not is_feature_branch(current_branch):
            deny(
                "Commits are allowed only on `feature/*` branches. "
                "Create/switch branch first (example: `git switch -c feature/<topic>`)."
            )

    if len(argv) >= 3 and argv[0] == "sudo" and argv[1] == "rm" and any(opt in {"-rf", "-fr"} for opt in argv[2:]):
        deny("`sudo rm -rf` is blocked.")

    print(json.dumps({
        "systemMessage": "Prefer read-only inspection first and keep Bash commands narrowly scoped."
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
