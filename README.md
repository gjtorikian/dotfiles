# Dotfiles

Your dotfiles are how you personalize your system. These are mine.

## Components

There's a few special files in the hierarchy.

- _bin/_: Anything in `bin/` will get added to your `$PATH` and be made
  available everywhere.

- _Brewfile_: This is a list of applications to install.

- _topic/path.zsh_: Any file named path.zsh is loaded first and is expected to
  expected to setup `$PATH` or similar.

- _topic/\*.zsh_: Any files ending in .zsh get loaded into your
  environment.

- _topic/\*.symlink_: Any file ending in `*.symlink` gets symlinked into
  your `$HOME`. This is so you can keep all of those versioned in your dotfiles
  but still keep those autoloaded files in your home directory. These get
  symlinked in when you run `script/bootstrap`.

## Setup

1. Clone the repository
2. `script/bootstrap`
   This will symlink the appropriate files in `.dotfiles` to your home directory. Everything is configured and tweaked within `~/.dotfiles`.
3. Reboot the machine
4. Open System Preferences
   - Disable iCloud password and keychain
   - Disable Use TouchID to unlock Mac
   - Enable Apple Watch unlock
   - Add Internet Accounts
   - Under Notifications:
     - Show Previews: Never
     - Allow when screened locked: off
     - Toggle off Play sound for notification.
   - Under Display:
     Enable Night Shift
5. Change the Finder Sidebar preferences
   1. Add Home
6. Sign into Dropbox
   1. Be prepared for lots of questions
7. Open 1password
   1. Open Safari to link extension
   2. Open Preferencess
      1. Under General change Autofill keyboard shortcut to cmd + l-shift + backslash
   3. Enable SSH Agent Under Developer
8. Open VS Code
   1. Enable Settings sync
9. iTerm2 preferences
   1. Import iterm.json theme
10. Open Alt-Tab
11. Change shortcut to Cmd + Tab
12. Open Scrivener
    1. Choose ~/Documents as Backup Folder
13. Open Safari
    1. Disable Autofill
14. `cd ~/.dotfiles; macos/restore_backups.sh`
15. Set up ngrok auth: https://dashboard.ngrok.com/get-started/your-authtoken
16. Run `gh extension install actions/gh-actions-cache`

## Thanks

- [@bswinnerton](https://www.github.com/bswinnerton)
- [@holman](https://www.github.com/holman)
- [@MikeMcQuaid](https://www.github.com/MikeMcQuaid)

nodenv install 18.16.0
nodenv global 18.16.0
rbenv install
