#!/bin/bash
#
# AquesTalkPi を使って発話する
#

echo $@
if [ $PULSE_SERVER == "host.docker.internal" ]; then
  ./modules/aquestalkpi/AquesTalkPi -v f2 $@ | aplay
else
  ./modules/aquestalkpi/AquesTalkPi -v f2 $@ | aplay -Dplug:softvol
fi
