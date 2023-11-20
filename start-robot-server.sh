#!/bin/bash
#
# RaspberryPi でロボットシステムを起動する
# 音声認識はレアゾン、音声合成は aquesTalkPi を使用
#

cd `dirname $0`
#./talk-f1.sh 起動中です
# sudo systemctl enable ntp
# sudo timedatectl set-ntp 1
#sleep 1
#export ROBOT_PRIVATE_KEY=~/.config/robot/robot-private-key.pem
#export ROBOT_PUBLIC_KEY=~/.config/robot/robot-public-key.pem
#export GOOGLE_APPLICATION_CREDENTIALS=~/.config/robot/google-text-to-speech-credentials.json
#export ROBOT_GOOGLE_SHEET_CREDENTIAL_PATH=~/.config/robot/sheet-api-credentials.json
#export ROBOT_GOOGLE_SHEET_TOKEN_PATH=~/.config/robot/sheet-api-token.json
#export ROBOT_GOOGLE_SPEECH_DATA_DIR=~/Sound
#export ROBOT_GOOGLE_SPEECH_CACHE_DB_PATH=~/Sound/robot-cacheDB.json
#export ROBOT_CREDENTIAL_ACCESS_CONTROL=true
#export ROBOT_ALLOW_LOCALHOST_ACCESS=false
export ROBOT_DEFAULT_VOICE=open-jTalk
export SPEECH=reazon
export ROBOT_BASE_DIR=`pwd`
node build/src/robot-server.js | tee robot-server.log
