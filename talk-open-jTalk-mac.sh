#!/bin/sh
TMP=/tmp/jsay.wav
VOICE_NAME="$1"
ALL_VOICE_PATH=`find ~/ -name *"$VOICE_NAME"*.htsvoice`
# echo $ALL_VOICE_PATH
for var in $ALL_VOICE_PATH
do
    VOICE_PATH="$var"
    echo $VOICE_PATH
    break
done
echo "$2" | open_jtalk \
-m $VOICE_PATH \
-x "~/Downloads/open_jtalk_dic_utf_8-1.10/" \
-ow $TMP && \
afplay $TMP
rm -f $TMP
