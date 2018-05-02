#!/bin/sh
cd ~

sudo apt-get install npm -y
sudo npm install n -g
sudo n lts
sudo npm install npm@latest -g

cd dora-engine
npm i

# Raspberr Pi Zero Wの場合は，以下のコメントアウトを外すこと
# npm rebuild --build-from-source grpc
