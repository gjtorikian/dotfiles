# Lazy-load rbenv for faster shell startup
# Use direct path check - $+commands is slow on long PATHs
if [[ -x /opt/homebrew/bin/rbenv ]]; then
  export PATH="$HOME/.rbenv/shims:$PATH"

  _rbenv_init() {
    unfunction ruby gem bundle rake rbenv 2>/dev/null
    eval "$(rbenv init -)"
  }

  ruby() { _rbenv_init && ruby "$@" }
  gem() { _rbenv_init && gem "$@" }
  bundle() { _rbenv_init && bundle "$@" }
  rake() { _rbenv_init && rake "$@" }
  rbenv() { _rbenv_init && rbenv "$@" }
fi
