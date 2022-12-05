#!/bin/bash
cd ./work/whisper.cpp
stream -f out.txt -kc -m ./models/ggml-base.bin -l ja --step 1000 --length 3000

# whisper.cpp で認識するときは whisper.cpp をビルドして /work/whisper.cpp に stream と models フォルダをコピー
# 次のコマンドを実行　npm run whisper
