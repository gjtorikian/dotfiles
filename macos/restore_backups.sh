#!/usr/bin/env bash

function perform_copy {
    cmd="${1}"
    filename="${2}"

    src="/Volumes/LaCie/Backups.backupdb/Gideon/Latest/Macintosh HD - Data/Users/gjtorikian/$filename"
    dest="$HOME/$filename"
    now=$(date +"%T")

    echo ''
    echo "($now) Copying $src to $dest ... "

    $cmd "$src" "$dest"

    now=$(date +"%T")
    echo "($now) Copied $dest"
}

declare -a folders=(
    .bundle
    .cargo
    .gem
    .rbenv
    .rustup
    .ssh
    Downloads
    go
);

declare -a files=(
    .dotfiles/git/gitconfig.local.symlink
);

if ! plutil -lint /Library/Preferences/com.apple.TimeMachine.plist >/dev/null ; then
  echo "This script requires your terminal app to have Full Disk Access." $red
  echo "Add this terminal to the Full Disk Access list in System Settingws > Privacy & Security, quit the app, and re-run this script."
  echo ""
  # shellcheck disable=SC2162
  read -p "If you are certain this terminal has Full Disk Access, press [Enter] to continue."
fi

for folder in "${folders[@]}"; do
    perform_copy "gcp -dr" "$folder"
done

for file in "${files[@]}"; do
    perform_copy "cp" "$file"
done
