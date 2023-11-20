#!/bin/bash
#
# ロボットの頭を稼働させたりボタン押下のイベントを発行させるプロセスを立ち上げる
#

cd `dirname $0`
node build/src/servo-head.js | tee servo-head.log
