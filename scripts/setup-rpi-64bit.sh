#!/bin/bash
#
# 64bit RaspberryPi OS で 32bit版AquasTalkPi を使用するための準備を行う
# 64bit版AquasTalkPi を使用する場合は不要
#

sudo dpkg --add-architecture armhf
sudo apt update
sudo apt install libc6:armhf libstdc++6:armhf
