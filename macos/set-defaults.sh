#!/usr/bin/env bash

# Sets reasonable macOS defaults.
#
# The original idea (and a couple settings) were grabbed from:
#   https://github.com/mathiasbynens/dotfiles/blob/master/.macos
#
# Also inspired by:
#   brandonb927's osx-for-hackers.sh: https://gist.github.com/brandonb927/3195465
#   andrewsardone's dotfiles: https://github.com/andrewsardone/dotfiles/blob/master/osx/osx-defaults
#   https://github.com/cdzombak/dotfiles/blob/0c30ea50908198877fa434762ede6e05a71a2b70/macos-configure.sh#L42

# Run ./set-defaults.sh and you'll be good to go.

# Close any open System Preferences panes, to prevent them from overriding
# settings we’re about to change
osascript -e 'tell application "System Preferences" to quit'

# Ask for the administrator password upfront
sudo -v

# Keep-alive: update existing `sudo` time stamp until `.macos` has finished
while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &

# Set computer name (as done via System Preferences → Sharing)
sudo scutil --set ComputerName "Nezu"
sudo scutil --set HostName "Nezu"
sudo scutil --set LocalHostName "Nezu"
sudo defaults write /Library/Preferences/SystemConfiguration/com.apple.smb.server NetBIOSName -string "Nezu"

defaults write NSGlobalDomain NSTableViewDefaultSizeMode -int 2

# Save to disk (not to iCloud) by default
defaults write NSGlobalDomain NSDocumentSaveNewDocumentsToCloud -bool false

# Enable automatic software update checks
defaults write com.apple.SoftwareUpdate AutomaticCheckEnabled -bool true

# Check for software updates daily, not just once per week
defaults write com.apple.SoftwareUpdate ScheduleFrequency -int 1

# "Download newly available updates in background
defaults write com.apple.SoftwareUpdate AutomaticDownload -int 1

# Install System data files & security updates
defaults write com.apple.SoftwareUpdate CriticalUpdateInstall -int 1

# Disable press-and-hold for keys in favor of key repeat.
defaults write -g ApplePressAndHoldEnabled -bool false

# Turn on app auto-update
defaults write com.apple.commerce AutoUpdate -bool true

# Use AirDrop over every interface. srsly this should be a default.
defaults write com.apple.NetworkBrowser BrowseAllInterfaces 1

# Increase sound quality for Bluetooth headphones/headsets
defaults write com.apple.BluetoothAudioAgent "Apple Bitpool Min (editable)" -int 40

# Set a really fast key repeat.
defaults write NSGlobalDomain KeyRepeat -int 5

# Enable the debug menu in Disk Utility
defaults write com.apple.DiskUtility DUDebugMenuEnabled -bool true

###############################################################################
# General UI/UX                                                               #
###############################################################################

# Disable the “Are you sure you want to open this application?” dialog
defaults write com.apple.LaunchServices LSQuarantine -bool false

# Disable "Click wallpaper to reveal desktop"
defaults write com.apple.WindowManager EnableStandardClickToShowDesktop -bool false

###############################################################################
# Finder                                                                      #
###############################################################################

# Always open everything in Finder's list view. This is important.
defaults write com.apple.Finder FXPreferredViewStyle Nlsv

# Show hidden files by default
defaults write com.apple.Finder AppleShowAllFiles -bool true

# Show all filename extensions
defaults write NSGlobalDomain AppleShowAllExtensions -bool true

# When performing a search, search the current folder by default
defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"

# Disable the warning when changing a file extension
defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

# Avoid creating .DS_Store files on network volumes
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true

# Automatically open a new Finder window when a volume is mounted
defaults write com.apple.frameworks.diskimages auto-open-ro-root -bool true
defaults write com.apple.frameworks.diskimages auto-open-rw-root -bool true
defaults write com.apple.finder OpenWindowForNewRemovableDisk -bool true

# Show the ~/Library folder
chflags nohidden ~/Library

# Set the Finder prefs for showing a few different volumes on the Desktop.
defaults write com.apple.finder ShowExternalHardDrivesOnDesktop -bool true
defaults write com.apple.finder ShowRemovableMediaOnDesktop -bool true

###############################################################################
# Screen
###############################################################################

# https://tonsky.me/blog/monitors/ convinced me to try this:
# Disabling subpixel font smoothing
defaults write NSGlobalDomain AppleFontSmoothing -int 0

###############################################################################
# Dock & hot corners                                                          #
###############################################################################

# Set the icon size of Dock items to 50 pixels
defaults write com.apple.dock tilesize -int 50

# Position Dock on left of screen
defaults write com.apple.dock orientation -string left

# Remove the auto-hiding Dock delay
defaults write com.apple.Dock autohide-delay -float 0

# Automatically hide and show the Dock
defaults write com.apple.dock autohide -bool true

# Hot corners
# Top left screen corner → Lock Screen
defaults write com.apple.dock wvous-tl-corner -int 13
defaults write com.apple.dock wvous-tl-modifier -int 0

# Show Safari's bookmark bar.
defaults write com.apple.Safari ShowFavoritesBar -bool true

###############################################################################
# Safari                                                                      #
###############################################################################

# Set up Safari for development.
defaults write com.apple.Safari IncludeInternalDebugMenu -bool false
defaults write com.apple.Safari IncludeDevelopMenu -bool true
defaults write com.apple.Safari WebKitDeveloperExtrasEnabledPreferenceKey -bool true
defaults write com.apple.Safari com.apple.Safari.ContentPageGroupIdentifier.WebKit2DeveloperExtrasEnabled -bool true
defaults write com.apple.Safari WebKitPreferences.developerExtrasEnabled 1
defaults write com.apple.Safari.SandboxBroker ShowDevelopMenu 1
defaults write com.apple.Safari WebKitPreferences.privateClickMeasurementEnabled 0

# Show the full URL in the address bar (note: this still hides the scheme)
defaults write com.apple.Safari ShowFullURLInSmartSearchField -bool true

# Safari: Warn about fraudulent websites
defaults write com.apple.Safari WarnAboutFraudulentWebsites -bool true

# Safari: Enable Do Not Track
defaults write com.apple.Safari SendDoNotTrackHTTPHeader -bool true

###############################################################################
# Shell & Terminal
###############################################################################

if [[ $SHELL != *"/zsh" ]]; then
  echo ""
  echo "Set zsh as default shell"
  chsh -s "$(command -v zsh)"
else
  echo ""
  echo "zsh is already the current shell"
fi

# Use UTF-8 only in Terminal.app
defaults write com.apple.terminal StringEncodings -array 4

# Set 'Often' update frequency in Activity Monitor
defaults write "com.apple.ActivityMonitor" "UpdatePeriod" '2'

###############################################################################

killall Dock
killall Finder

echo ""
echo "✔ Done."
echo ""
echo "macOS configuration complete."
echo "Note that some of these changes require a logout/restart to take effect."
echo "Please restart the system."
