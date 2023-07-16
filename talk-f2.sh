#!/bin/bash
#
# AquesTalkPi を使って発話する
#

echo $@
../Downloads/aquestalkpi/AquesTalkPi -v f2 $@ | aplay
