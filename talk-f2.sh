#!/bin/bash
#
# AquesTalkPi を使って発話する
#

echo $@
./modules/aquestalkpi/AquesTalkPi -v f2 $@ | aplay -Dplug:softvol
