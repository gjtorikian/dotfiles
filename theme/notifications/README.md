# Notification sounds

Task-complete chimes for Claude Code, played by
[`.claude/hooks/sounds-on-task-complete.sh`](../../.claude/hooks/sounds-on-task-complete.sh).

## How it works

1. A slash command sets the active **sound mode** by writing its name to
   `/tmp/claude-sound-mode`:

   | Command          | Mode      |
   | ---------------- | --------- |
   | `/zelda`         | `zelda`   |
   | `/mario`         | `mario`   |
   | `/wc3`           | `wc3`     |
   | `/sound-default` | (default) |

   The active mode also shows up in the statusline (`bin/claude-status`).

2. When a task finishes, the `Stop` hook plays a sound chosen by **how long the
   task ran** (the tier) within the **active mode**:

   | Elapsed time | Tier     |
   | ------------ | -------- |
   | < 2 min      | (silent) |
   | 2–5 min      | `short`  |
   | 5–10 min     | `medium` |
   | 10 min+      | `long`   |

Each mode folder expects `short.mp3`, `medium.mp3`, and `long.mp3`. Files may be
real audio or relative symlinks into `_src/`. Anything `afplay` understands
(mp3, m4a, wav, aiff) works — keep the `.mp3` name regardless.
