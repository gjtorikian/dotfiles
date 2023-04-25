#!/usr/bin/env bash

source "$ZSH/macos/dock_functions.sh"

defaults write com.apple.dock persistent-apps -array

declare -a apps=(
    '/Applications/iTerm.app'
);

# declare -a folders=(
#     ~/Downloads
# );

clear_dock
disable_recent_apps_from_dock

for app in "${apps[@]}"; do
    add_app_to_dock "$app"
done

# for folder in "${folders[@]}"; do
#     add_folder_to_dock $folder
# done

