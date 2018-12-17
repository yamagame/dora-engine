#!/bin/bash
cd `dirname $0`
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install libusb-1.0-0 libusb-1.0-0-dev libudev-dev
npm install usb-detection node-hid
