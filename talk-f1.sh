#!/bin/bash
#
# AquesTalkPi を使って発話する
#

echo $@
if [ $PULSE_SERVER == "host.docker.internal" ]; then
  ./modules/aquestalkpi/AquesTalkPi $@ | aplay
else
  ./modules/aquestalkpi/AquesTalkPi $@ | aplay -Dplug:softvol
fi
