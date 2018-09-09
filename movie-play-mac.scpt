#!/usr/bin/osascript
on run argv
  set unixFile to item 1 of argv
  set macFile to POSIX file unixFile
  set fileRef to (macFile as alias)

  tell application "QuickTime Player"
    activate
    open fileRef
    -- present front document
    play front document
    delay 3
    try
      repeat until not (playing of front document)
        delay 1
      end repeat
    on error error_quit
    end try
    close front document
  end tell
end run
