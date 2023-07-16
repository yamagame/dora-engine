#!/bin/bash
#
# AquesTalkPi を使って発話する
#

echo $@
../Downloads/aquestalkpi/AquesTalkPi $@ | aplay
