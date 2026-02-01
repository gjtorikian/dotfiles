#!/bin/bash
# Fix nodenv lazy-load wrappers that break in Claude Code's shell snapshot.
# The snapshot captures node/npm/npx as functions calling _nodenv_init,
# but doesn't capture _nodenv_init itself. This hook prepends an unfunction
# call so the nodenv shims in PATH take over.

INPUT=$(cat)

# Fast path: skip commands that don't involve node/npm/npx
echo "$INPUT" | grep -qE '\b(node|npm|npx)\b' || exit 0

echo "$INPUT" | jq '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    updatedInput: {
      command: ("unfunction node npm npx nodenv 2>/dev/null; " + .tool_input.command)
    }
  }
}'
