# Disable stdout/stderr buffering, equivalent to -u
export PYTHONUNBUFFERED=true

# Don't write .pyc files, equivalent to -B
export PYTHONDONTWRITEBYTECODE=true

# Custom global pip install
function gpip() {
    PIP_REQUIRE_VIRTUALENV="" pip "$@"
}

# Let mise own Python when available. With both shim directories on PATH,
# their system-Python fallbacks can resolve to each other indefinitely.
if command -v mise &> /dev/null; then
  # Also clean up PATH and lazy wrappers inherited from the previous setup.
  path=("${(@)path:#${PYENV_ROOT}/shims}")
  if (( $+functions[_pyenv_init] )); then
    unfunction _pyenv_init python python3 pip pip3 pyenv 2>/dev/null || true
  fi
elif [[ -d "$PYENV_ROOT" ]]; then
  # Lazy-load pyenv on machines without mise.
  export PATH="$PYENV_ROOT/shims:$PATH"

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
