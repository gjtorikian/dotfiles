# Disable stdout/stderr buffering, equivalent to -u
export PYTHONUNBUFFERED=true

# Don't write .pyc files, equivalent to -B
export PYTHONDONTWRITEBYTECODE=true

# Custom global pip install
function gpip() {
    PIP_REQUIRE_VIRTUALENV="" pip "$@"
}

# Lazy-load pyenv for faster shell startup
if [[ -d "$PYENV_ROOT" ]]; then
  export PATH="$HOME/.pyenv/shims:$PATH"

  _pyenv_init() {
    unfunction python python3 pip pip3 pyenv 2>/dev/null
    eval "$(pyenv init -)"
  }

  python() { _pyenv_init && python "$@" }
  python3() { _pyenv_init && python3 "$@" }
  pip() { _pyenv_init && pip "$@" }
  pip3() { _pyenv_init && pip3 "$@" }
  pyenv() { _pyenv_init && pyenv "$@" }
fi
