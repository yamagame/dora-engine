#!/bin/bash
cd `dirname $0`
node button-server.js &
sudo node button-gpio.js
