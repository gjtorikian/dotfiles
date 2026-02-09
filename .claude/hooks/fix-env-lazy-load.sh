#!/bin/bash
# Fix nodenv/rbenv lazy-load wrappers that break in Claude Code's shell snapshot.
# The snapshot captures wrapper functions (e.g. node, ruby) that call _nodenv_init
# or _rbenv_init, but doesn't capture those init functions. This hook prepends an
# unfunction call so the shims in PATH take over.

INPUT=$(cat)

# Fast path: skip commands that don't involve any *env-managed tools
echo "$INPUT" | grep -qE '\b(node|npm|npx|ruby|gem|bundle|rake|rbenv)\b' || exit 0

echo "$INPUT" | jq '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    updatedInput: {
      command: ("unfunction node npm npx nodenv ruby gem bundle rake rbenv 2>/dev/null; " + .tool_input.command)
    }
  }
}'
