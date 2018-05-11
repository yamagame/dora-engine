#!/bin/bash
cd `dirname $0`
sudo /etc/init.d/ntp stop
sudo ntpd -q -g
sudo /etc/init.d/ntp start &
sleep 1
node robot-server.js > robot-server.log
