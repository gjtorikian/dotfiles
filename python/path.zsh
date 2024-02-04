export PATH="$HOME/.poetry/bin:$PATH"

export PYENV_ROOT="$HOME/.pyenv"

if [[ -d "$PYENV_ROOT" ]]; then
    # Add Pyenv to the path
    export PATH="$PYENV_ROOT/bin:$PATH"
fi
