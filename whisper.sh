#!/bin/bash
#
# Whisper を使用して音声認識を行う
# whisper.cpp で認識するときは whisper.cpp をビルドして ./modules/whisper.cpp に stream と models フォルダをコピー
# 次のコマンドを実行してロボットシステムを起動する
#
# npm run whisper
#

cd ./modules/whisper.cpp
stream -f out.txt -kc -m ./models/ggml-base.bin -l ja --step 1000 --length 3000
