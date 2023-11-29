#!/bin/bash
#
# AquesTalkPi を使って発話する
#

echo $@
./modules/aquestalkpi/AquesTalkPi $@ | aplay -Dplug:softvol
