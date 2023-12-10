# mac / docker で音声テスト

下記ページを参考に pulseaudio と Docker イメージを準備。

- [コンテナから音の再生](https://github.com/yamagame/dora-agent/blob/main/docs/DOCKER-AUDIO.md)
- [RaspiOS を Mac 上の Docker で動作させる手順](https://github.com/yamagame/dora-agent/blob/main/docs/DOCKER-RPI.md)

```sh
# mac 側で pulseaudio を起動
$ pulseaudio -k && pulseaudio --load=module-native-protocol-tcp --exit-idle-time=-1 --daemon

# ラズパイイメージを起動
$ docker run --name rpi-dora-engine -it --rm -e PULSE_SERVER=host.docker.internal -v ./:/app -v ~/.config/pulse:/root/.config/pulse -p 3090:3090 -p 4000:4000 -w /app --entrypoint /bin/bash raspios_dialog_system

# 起動しているコンテナにログインする場合
$ docker exec -it rpi-dora-engine /bin/bash

# サウンドテスト
$ aplay ./scenario/Sound/Pop.wav

# 必要なライブラリをインストール
$ ./scripts/setup-rpi-64bit.sh

# 必要なモジュールをインストール
$ yarn install

# シナリオのコピー
$ cp -r ./scenario/* /root

# dora-engineの実行
$ yarn start
```

http://localhost:3090 を開き、名前に dora-engine と入力
