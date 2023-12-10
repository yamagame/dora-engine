#!/bin/sh
#
# RaspberryPi でロボットシステムを稼働させるための準備を行う
#

cd ~

#sudo apt-get remove --purge wolfram-engine oracle-java8-jdk openjdk-8-jre gcj-6-jre -y
#sudo apt autoremove -y

sudo apt-get update
sudo apt-get upgrade -y

export CLOUD_SDK_REPO="cloud-sdk-$(lsb_release -c -s)"
echo "deb http://packages.cloud.google.com/apt $CLOUD_SDK_REPO main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
sudo apt-get update && sudo apt-get install google-cloud-sdk -y

#sudo apt-get install mecab libmecab-dev mecab-ipadic-utf8 -y
sudo apt-get install ibus-anthy -y
sudo apt-get install ntp -y
sudo apt-get install sqlite3 -y

#cd `dirname $0`
#sudo cp asound.conf /etc/
#sudo chown root:root /etc/asound.conf

mkdir -p Sound
