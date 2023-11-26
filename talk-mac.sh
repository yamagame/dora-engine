#!/bin/bash
#
# sayコマンド(mac用) を使って発話する
#

R_OPTION=$1
R_RATE=$2
SPEECH_TEXT=$3
VOICE_ID=$4
if [ "$VOICE_ID" = "" ]; then
  say $R_OPTION $R_RATE $SPEECH_TEXT
else
  say -v $VOICE_ID $R_OPTION $R_RATE $SPEECH_TEXT
fi
