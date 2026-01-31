# Lazy-load nodenv for faster shell startup
export PATH="$HOME/.nodenv/shims:$PATH"

_nodenv_init() {
  unfunction node npm npx nodenv 2>/dev/null
  eval "$(nodenv init -)"
}

node() { _nodenv_init && node "$@" }
npm() { _nodenv_init && npm "$@" }
npx() { _nodenv_init && npx "$@" }
nodenv() { _nodenv_init && nodenv "$@" }
