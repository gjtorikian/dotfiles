#!/bin/bash
# Play a task-complete sound based on (1) how long the task ran and
# (2) the currently selected sound mode (/zelda, /mario, /wc3, /sound-default).
#
# The active mode is written to MODE_FILE by the slash commands in
# .claude/commands/. Sounds live in SOUND_ROOT/<mode>/{short,medium,long}.mp3.
#
# Per-tier fallback chain (keeps things playing even when audio is missing):
#   <mode>/<tier>.mp3  ->  any *.mp3 in <mode>/  ->
#   default/<tier>.mp3 ->  any *.mp3 in default/  ->  silence

START_TIME_FILE="/tmp/claude-task-start-time"
MODE_FILE="/tmp/claude-sound-mode"
SOUND_ROOT="/Users/gjtorikian/.dotfiles/theme/notifications"

# ── resolve the active mode ─────────────────────────────────────────────────
mode="default"
[ -f "$MODE_FILE" ] && mode="$(tr -d '[:space:]' < "$MODE_FILE")"
[ -z "$mode" ] && mode="default"
[ -d "$SOUND_ROOT/$mode" ] || mode="default"

# ── pick a playable file for a tier, with fallbacks ─────────────────────────
pick() {
  local tier="$1" dir f
  for dir in "$SOUND_ROOT/$mode" "$SOUND_ROOT/default"; do
    [ -d "$dir" ] || continue
    [ -e "$dir/$tier.mp3" ] && { echo "$dir/$tier.mp3"; return; }
    f=$(ls "$dir"/*.mp3 2>/dev/null | head -n1)
    [ -n "$f" ] && [ -e "$f" ] && { echo "$f"; return; }
  done
}

play() {
  local file="$1" vol="$2"
  [ -n "$file" ] && [ -e "$file" ] || return
  if [ -n "$vol" ]; then
    afplay --volume "$vol" "$file" &
  else
    afplay "$file" &
  fi
}

# ── play based on elapsed time ──────────────────────────────────────────────
[ -f "$START_TIME_FILE" ] || exit 0
START_TIME=$(cat "$START_TIME_FILE")
ELAPSED=$(($(date +%s) - START_TIME))

if [ "$ELAPSED" -lt 120 ]; then
  : # < 2 min — stay quiet
elif [ "$ELAPSED" -lt 300 ]; then
  play "$(pick short)" # 2–5 min
elif [ "$ELAPSED" -lt 600 ]; then
  play "$(pick medium)" # 5–10 min
else
  play "$(pick long)" 0.8 # 10 min+
fi

exit 0
