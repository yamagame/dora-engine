#!/bin/bash
bash <(curl -sL https://raw.githubusercontent.com/node-red/raspbian-deb-package/master/resources/update-nodejs-and-nodered)

ln -s /home/pi/dora-engine/robot-controller/ ~/.node-red/node_modules/node-red-robot-controller
cd robot-controller
npm i
