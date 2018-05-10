#!/bin/bash
cd `dirname $0`
sudo /etc/init.d/ntp stop
sudo ntpd -q -g
sudo /etc/init.d/ntp start
node robot-server.js
