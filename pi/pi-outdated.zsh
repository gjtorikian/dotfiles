# Cached "pi is outdated" alert, scoped to `pi` invocations (not every terminal).
#
# pi's own startup banner says `pi update`, which is wrong here: Homebrew owns
# the binary, so you need `brew upgrade pi-coding-agent`. This wraps `pi` in a
# shell function that prints the right reminder before launching the real TUI.
# pi renders inline (no alt-screen), so the line stays visible above the TUI.
#
# The check reads a cache (instant); `brew outdated` only runs in the background
# when the cache is >24h stale, so a normal `pi` launch is never blocked.
#
# Cache: ${XDG_CACHE_HOME:-~/.cache}/pi/outdated  (machine state, not dotfiles)

pi() {
  zmodload zsh/datetime 2>/dev/null   # EPOCHSECONDS
  zmodload zsh/stat    2>/dev/null   # zstat

  local cache="${XDG_CACHE_HOME:-$HOME/.cache}/pi/outdated"
  local now=$EPOCHSECONDS
  local bin; bin=$(whence -p pi 2>/dev/null)

  if [[ -f $cache ]] && read -rA fields < $cache; then
    local cepoch=$fields[1] cstatus=$fields[2] cinstalled=$fields[3] cavail=$fields[4] bin_mtime
    # Invalidate if pi was upgraded after the cache was written (new Cellar dir
    # has a newer mtime), so the alert clears right after `brew upgrade`.
    zstat -A bin_mtime +mtime -L "$bin" 2>/dev/null
    if [[ -n $bin_mtime ]] && (( bin_mtime > cepoch )); then
      rm -f "$cache"
    elif (( now - cepoch < 86400 )); then
      [[ $cstatus == outdated ]] && print -u2 -P "%F{yellow}⚠ pi-coding-agent %F{cyan}$cavail%f%F{yellow} available (you have $cinstalled) — run %F{cyan}brew upgrade pi-coding-agent%f%F{yellow}.%f"
      command pi "$@"
      return
    fi
  fi

  # Cache stale/missing: warm it in the background, launch pi now (silent this run;
  # the next `pi` shows the result). &! = background + disown, no tty pollution.
  () {
    mkdir -p -- "${cache:h}"
    local line; line=$(brew outdated --verbose pi-coding-agent 2>/dev/null)
    if [[ -n $line ]]; then
      local installed avail
      read -r installed avail < <(print -r -- "$line" | awk '{gsub(/[()]/,""); print $2, $4}')
      print -r -- "$(date +%s) outdated $installed $avail"
    else
      print -r -- "$(date +%s) current - -"
    fi > "$cache"
  } &!
  command pi "$@"
}
