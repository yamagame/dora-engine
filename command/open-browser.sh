#!/bin/bash
export DISPLAY=:0
if [ `uname` = "Linux" ]; then
chromium-browser --start-fullscreen --start-maximized --app=http://localhost:3090/ &
fi
