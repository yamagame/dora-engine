#!/bin/bash
cd `dirname $0`
rm ./work/*.raw
rm ./work/*.wav
python -W ignore ./stream_asr.py whisper | grep --line-buffered ">"


##################################################################
# 動かし方
#
# asr_whisper.py は localhost:8080 に向けてPOSTリクエストしている
# そのため、localhostでwhisper.cppのserverコマンドを実行しておく必要がある
#
# ./server -m models/ggml-medium.bin
#
