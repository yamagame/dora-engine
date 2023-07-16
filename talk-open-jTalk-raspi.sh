#!/bin/sh
#
# OpenJTalk(RaspberryPi用) を使って発話する
#

TMP="$3"
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
-x "/var/lib/mecab/dic/open-jtalk/naist-jdic/" \
-ow $TMP
