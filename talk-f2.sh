#!/bin/bash
echo $@
../Downloads/aquestalkpi/AquesTalkPi -v f2 $@ | aplay -Dplug:softvol
