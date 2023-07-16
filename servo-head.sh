#!/bin/bash
#
# ロボットの頭を稼働させたりボタン押下のイベントを発行させるプロセスを立ち上げる
#

cd `dirname $0`
node src/servo-head.js > servo-head.log
