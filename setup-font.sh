#!/bin/sh
#
# RaspberryPi に Noto フォントをインストールするスクリプト
#

#lsb_release -a
#sudo apt-cache search font japanese
#sudo apt-cache search font japanese | grep noto
sudo apt-get -y install fonts-noto
