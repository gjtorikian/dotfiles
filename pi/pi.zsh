# Point pi coding agent to dotfiles-managed config
export PI_CODING_AGENT_DIR="$HOME/.dotfiles/pi"

# pi-workgraph: register the pi-subagents bridge as an executor
# (planner/implementer/reviewer roles for planned/reviewed work)
export WORKGRAPH_SUBAGENTS_EXECUTOR=true
