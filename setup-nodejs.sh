#!/bin/sh
#
# RaspberryPi で Node.js を使用するための準備を行う
#

cd ~

sudo apt update
sudo apt install -y nodejs npm
sudo npm install -g yarn

# sudo apt-get install npm -y
# sudo npm install n -g
# sudo n lts
# sudo npm install npm@latest -g

# sudo apt-get update
# sudo apt-get install -y ca-certificates curl gnupg
# sudo mkdir -p /etc/apt/keyrings
# curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

# NODE_MAJOR=20
# echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

# sudo apt-get update
# sudo apt-get install nodejs -y

cd dora-engine
npm i
