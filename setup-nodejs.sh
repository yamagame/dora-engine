#!/bin/sh
#
# RaspberryPi で Node.js を使用するための準備を行う
#

cd ~

sudo apt-get install npm -y
sudo npm install n -g
sudo n lts
sudo npm install npm@latest -g

cd dora-engine
npm i
