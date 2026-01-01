# Dotfiles

Your dotfiles are how you personalize your system. These are mine.

## Components

There are a few special files in the hierarchy.

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
2. Come up with a new machine name. Set it in `set-defaults.sh`.
3. `script/bootstrap`
   This will symlink the appropriate files in `.dotfiles` to your home directory. Everything is configured and tweaked within `~/.dotfiles`. You may need to turn off Full Disk Encryption (in Settings) for Terminal to continue its process.
4. Reboot the machine
5. Open Safari
   - Disable [autofill](https://support.1password.com/disable-browser-password-manager/#if-youre-using-safari-mac)
6. Open System Preferences
   - Disable iCloud password and keychain
   - Enable [Documents and Desktop sync](https://support.apple.com/en-us/109344)
   - Disable Use TouchID to unlock Mac
   - Add Internet Accounts
   - Under Notifications:
     - Show Previews: Never
     - Allow when screened locked: off
     - Toggle off Play sound for notification.
   - Under Display:
     Enable Night Shift
   - Set languages in Input Sources
   - Disable automatic spelling correction
7. Change the Finder Sidebar preferences
   - Add Home
8. Sign in to Dropbox
   - Be prepared for lots of questions
9. Open 1password
   - Open Safari to link extension
   - Open Preferences
     - Under General change Autofill keyboard shortcut to cmd + l-shift + backslash
   - Enable SSH Agent Under Developer
10. Open VS Code
   - Enable Settings sync

11. iTerm2 preferences
    - Import iterm.json theme
12. Open Alt-Tab
    - Change shortcut to Cmd + Tab
13. Open Scrivener
    - Choose ~/Documents as Backup Folder
14. `cd ~/.dotfiles; macos/restore_backups.sh`
15. Set up ngrok auth: https://dashboard.ngrok.com/get-started/your-authtoken

## Thanks

- [@bswinnerton](https://www.github.com/bswinnerton)
- [@holman](https://www.github.com/holman)
- [@MikeMcQuaid](https://www.github.com/MikeMcQuaid)
