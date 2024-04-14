#!/bin/bash
cd `dirname $0`
rm ./work/*.raw
rm ./work/*.wav
# python -W ignore ./stream_asr.py
python -W ignore ./stream_asr.py | grep --line-buffered ">"
