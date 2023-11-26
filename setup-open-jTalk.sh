#!/bin/bash
#
# RaspberryPi で OpenJTalk を使用するための準備を行う
#

if [ `uname` = "Linux" ]; then
  sudo apt-get update
  sudo apt-get upgrade -y
  sudo apt-get install open-jtalk -y
  # sudo apt-get install open-jtalk-mecab-naist-jdic hts-voice-nitech-jp-atr503-m001 -y
fi

pushd ./modules
mkdir -p open_jtalk
cd open_jtalk

# Download and restore dictionary
curl -L -o open_jtalk_dic_utf_8-1.11.tar.gz https://sourceforge.net/projects/open-jtalk/files/Dictionary/open_jtalk_dic-1.11/open_jtalk_dic_utf_8-1.11.tar.gz
tar -zxvf open_jtalk_dic_utf_8-1.11.tar.gz

# Download voice mei
curl -L -o MMDAgent_Example-1.7.zip https://jaist.dl.sourceforge.net/project/mmdagent/MMDAgent_Example/MMDAgent_Example-1.7/MMDAgent_Example-1.7.zip
unzip MMDAgent_Example-1.7.zip MMDAgent_Example-1.7/Voice/*

# Download voice tohoku
git clone https://github.com/icn-lab/htsvoice-tohoku-f01.git

echo print all htsvoice path below 合成音声ファイルのパスを一覧で表示
find . -name **.htsvoice

popd
