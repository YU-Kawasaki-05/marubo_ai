#!/usr/bin/env python3
import json
from pathlib import Path

workspace_notes = []
agents = Path("AGENTS.md")
if agents.exists():
    workspace_notes.append("Workspace has AGENTS.md; follow repository expectations before editing.")
if Path(".agents/skills").exists():
    workspace_notes.append("Repo-local skills are available in .agents/skills; prefer them for recurring workflows.")
elif Path("skills").exists():
    workspace_notes.append("Repo-local skills are available. Prefer them for recurring workflows.")
if Path(".codex/config.toml").exists():
    workspace_notes.append("Project-scoped Codex config is active from .codex/config.toml.")
if Path("docs/AGENTS.override.md").exists():
    workspace_notes.append("Directory-level instruction overrides exist under docs/.")

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": " ".join(workspace_notes) or "No extra workspace notes."
    }
}))
