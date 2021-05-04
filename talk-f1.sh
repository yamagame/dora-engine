#!/bin/bash
echo $@
../Downloads/aquestalkpi/AquesTalkPi $@ | aplay
