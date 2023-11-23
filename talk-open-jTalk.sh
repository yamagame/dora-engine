#!/bin/sh
#
# OpenJTalk を使って発話する
#

cd `dirname $0`
TMP="$3"
USER_NAME=`whoami`
VOICE_NAME="$1"
ALL_VOICE_PATH=`find ./modules/open_jtalk/ -name *"$VOICE_NAME"*.htsvoice`
# echo $ALL_VOICE_PATH
for var in $ALL_VOICE_PATH
do
    VOICE_PATH="$var"
    echo $VOICE_PATH
    break
done
echo "$2" | open_jtalk \
-m $VOICE_PATH \
-x ./modules/open_jtalk/open_jtalk_dic_utf_8-1.11 \
-ow $TMP
