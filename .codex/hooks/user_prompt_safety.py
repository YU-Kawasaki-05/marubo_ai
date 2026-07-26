#!/usr/bin/env python3
import json
import re
import sys


def main() -> int:
    payload = json.load(sys.stdin)
    prompt = str(payload.get("prompt", "") or "")

    high_confidence_patterns = [
        r"sk-[A-Za-z0-9]{20,}",
        r"AKIA[0-9A-Z]{16}",
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    ]
    caution_patterns = [
        r"ghp_[A-Za-z0-9]{20,}",
        r"xox[baprs]-[A-Za-z0-9-]{20,}",
    ]

    for pattern in high_confidence_patterns:
        if re.search(pattern, prompt):
            print(json.dumps({
                "decision": "block",
                "reason": "Prompt appears to include a secret. Remove credentials before sending."
            }))
            return 0

    for pattern in caution_patterns:
        if re.search(pattern, prompt):
            print(json.dumps({
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": "Prompt may contain a token-like string. Double-check before continuing."
                }
            }))
            return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
