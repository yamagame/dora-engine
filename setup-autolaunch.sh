#!/bin/sh
#
# RaspberryPi でロボットシステムを自動起動させるsystemdの設定を行う
#

cd ~

cd dora-engine
sudo mv robot-server.service /lib/systemd/system/
sudo mv servo-head.service /lib/systemd/system/
sudo mv movie-client.service /lib/systemd/system/
sudo systemctl enable robot-server.service
sudo systemctl enable servo-head.service
sudo systemctl enable movie-client.service
# sudo service robot-server start
# sudo service servo-head start
# sudo service movie-client start
