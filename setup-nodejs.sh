#!/bin/sh
cd ~

sudo apt-get install npm -y
sudo npm install n -g
sudo n lts
sudo npm install npm@latest -g

cd dora-engine
npm i

# 実行するとgrpcがエラーになる場合は，以下のコマンドを実行する
# npm rebuild --build-from-source grpc
