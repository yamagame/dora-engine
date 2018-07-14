#!/bin/sh
cd ~

sudo apt-get update
sudo apt-get upgrade -y

sudo apt-get install open-jtalk -y
sudo apt-get install open-jtalk-mecab-naist-jdic hts-voice-nitech-jp-atr503-m001 -y

cd ~/Downloads/
# Download and restore dictionary
wget https://sourceforge.mirrorservice.org/o/op/open-jtalk/Dictionary/open_jtalk_dic-1.10/open_jtalk_dic_utf_8-1.10.tar.gz
tar -zxvf open_jtalk_dic_utf_8-1.10.tar.gz

# Download voice mei
wget https://jaist.dl.sourceforge.net/project/mmdagent/MMDAgent_Example/MMDAgent_Example-1.7/MMDAgent_Example-1.7.zip
unzip MMDAgent_Example-1.7.zip MMDAgent_Example-1.7/Voice/*

# Download voice tohoku
git clone https://github.com/icn-lab/htsvoice-tohoku-f01.git

echo print all htsvoice path below 合成音声ファイルのパスを一覧で表示
find ~/ -name **.htsvoice

cd ~
