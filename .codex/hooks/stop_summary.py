#!/usr/bin/env python3
import json
from pathlib import Path
from datetime import datetime, timezone

out_dir = Path(".codex-state")
out_dir.mkdir(exist_ok=True)
summary_file = out_dir / "last_stop_summary.txt"
summary_file.write_text(
    f"Session stopped at {datetime.now(timezone.utc).isoformat()}\n"
    "Review recent diffs, verification output, and pending risks before resuming.\n",
    encoding="utf-8",
)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "Stop",
        "additionalContext": "Wrote .codex-state/last_stop_summary.txt"
    }
}))
