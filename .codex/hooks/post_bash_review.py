#!/usr/bin/env python3
import json
import sys

payload = json.load(sys.stdin)
tool_response = payload.get("tool_response", {})
if isinstance(tool_response, str):
    try:
        tool_response = json.loads(tool_response)
    except json.JSONDecodeError:
        tool_response = {}
if not isinstance(tool_response, dict):
    tool_response = {}

exit_code = tool_response.get("exit_code")
stdout = str(tool_response.get("stdout", "") or "")
stderr = str(tool_response.get("stderr", "") or "")

notes = []
if exit_code not in (0, None):
    notes.append("Previous Bash command failed; inspect stderr before continuing.")
if "warning" in stdout.lower() or "warning" in stderr.lower():
    notes.append("Previous Bash command emitted a warning.")
if "generated" in stdout.lower() or "generated" in stderr.lower():
    notes.append("Generated files may need manual review.")
if "permission denied" in stdout.lower() or "permission denied" in stderr.lower():
    notes.append("A permission failure occurred; check sandbox and approval mode.")
if "not found" in stderr.lower():
    notes.append("A command or executable was not found; verify the tool is installed.")

if notes:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": " ".join(notes)
        }
    }))
