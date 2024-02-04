#! /usr/bin/env bash

# Disable stdout/stderr buffering, equivalent to -u
export PYTHONUNBUFFERED=true

# Don't write .pyc files, equivalent to -B
export PYTHONDONTWRITEBYTECODE=true

# Require a python virtual environment for pip to install things
# export PIP_REQUIRE_VIRTUALENV=true

# Custom global pip install
function gpip() {
    PIP_REQUIRE_VIRTUALENV="" pip "$@"
}

if [[ -d "$PYENV_ROOT" ]]; then
    # Initialize Pyenv in the shell
    eval "$(pyenv init -)"
fi
