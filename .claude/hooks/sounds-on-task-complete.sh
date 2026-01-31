#!/bin/bash
# Play different sounds based on task duration

START_TIME_FILE="/tmp/claude-task-start-time"
SOUND_DIR="/Users/gjtorikian/.dotfiles/theme/notifications"

if [ -f "$START_TIME_FILE" ]; then
  START_TIME=$(cat "$START_TIME_FILE")
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))

  if [ "$ELAPSED" -lt 60 ]; then
    # Less than 1 minute
    afplay "$SOUND_DIR/super-mario-world-coin.mp3" &
  elif [ "$ELAPSED" -lt 600 ]; then
    # Less than 10 minutes
    afplay "$SOUND_DIR/super-mario-world-multiple-coins.mp3" &
  else
    # 10 minutes or longer
    afplay "$SOUND_DIR/oot-139-item-catch.mp3" &
  fi
fi

exit 0
