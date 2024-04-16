#!/bin/bash
cd `dirname $0`
python -W ignore ./stream_asr.py | grep --line-buffered ">"
