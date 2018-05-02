#!/bin/sh
cd ~

wget -O NotoSansCJKjp-hinted.zip https://noto-website-2.storage.googleapis.com/pkgs/NotoSansCJKjp-hinted.zip
unzip -d NotoSansCJKjp-hinted NotoSansCJKjp-hinted.zip
sudo mkdir -p /usr/share/fonts/opentype
sudo mv -fv ./NotoSansCJKjp-hinted /usr/share/fonts/opentype/note
sudo fc-cache -fv
