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

#sudo apt-get install sqlite3 -y

mkdir -p Sound
