#!/bin/sh
cd ~

sudo apt-get update
sudo apt-get upgrade -y

export CLOUD_SDK_REPO="cloud-sdk-$(lsb_release -c -s)"
echo "deb http://packages.cloud.google.com/apt $CLOUD_SDK_REPO main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
sudo apt-get update && sudo apt-get install google-cloud-sdk -y

sudo apt-get purge wolfram-engine -y
sudo apt-get install mecab libmecab-dev mecab-ipadic-utf8 -y
sudo apt-get install ibus-anthy -y
