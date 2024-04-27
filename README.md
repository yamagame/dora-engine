# Dora Engine

ラズベリーパイと [RasPi-VoiceBot](https://yamagame.github.io/dora-board) で作るコミュニケーションロボットエンジンです。

<p align="center">
  <img src="./images/IMG_6691.jpg"/>
</p>

## 特徴

- 音声認識、音声合成機能を持つ Raspberry Pi を使った手作りできるコミュニケーションロボットです。
- 部品代は AquesTalk Pi を含めて 3 万円ほどです。
- 専用スクリプト言語を使ってロボットのコントロールを簡単に行えます。
- 外部のパソコンなしにロボット単体で画像と連携したプレゼンテーションができます。
- 外装はダンボールですのでお好みに合わせて自由に変更できます。
- 言語の翻訳機能を持たせることもできます。

### 音声認識

音声認識はマイクに入力した音声を文字列に変換する機能です。
デフォルトでは Chrome の [Web Speech API Speech Recognition](https://developer.mozilla.org/ja/docs/Web/API/SpeechRecognition) を使います。

Speech API を使用するには https 接続か localhost 接続が必要です。Raspberry Pi で dora-engine を動かす場合は、そのままでは音声認識できませんので、Chrome ブラウザを開く PC に dora-engine へのプロキシー(nginxなど)を立てて接続します。

[プロキシーのサンプル / nginx-proxy](https://github.com/yamagame/nginx-proxy)

以下の URL を Chrome ブラウザで開き、localhost 接続で dora-engine へ接続します。

http://localhost:3090/browser-speech

あわせて以下の URL でシナリオを編集できます。

http://localhost:3090/scenario-editor

環境変数を設定することで以下の音声認識を選択することもできます。

- Web Speech API (Chrome)
- ReazonSpeech
- Whisper

### 音声合成

音声合成には以下のものを選択できます。

- [OpenJTalk](http://open-jtalk.sp.nitech.ac.jp/)
- [AquesTalk Pi](https://www.a-quest.com/products/aquestalkpi.html) (linuxのみ/デフォルト)
- say コマンド (macのみ/デフォルト)
- [Google Text-to-Speech](https://cloud.google.com/text-to-speech/)
- [AWS Polly](https://aws.amazon.com/jp/polly/)

[Google Text-to-Speech](https://cloud.google.com/text-to-speech/) や [AWS Polly](https://aws.amazon.com/jp/polly/) を使うと外国語を話すことができます。

### 言語翻訳

言語翻訳には [Google Translation API](https://cloud.google.com/translate/) を使用します。

### 頭部の稼働

サーボモーター２つを使って頭が上下左右に動きます。頭の動きは自動的に行われます。何も指示がないときにはロボットの頭部は上下左右にランダムに動きます。ロボットがおしゃべりしているときは頭が上下に動きます。

### 専用スクリプト言語

専用のスクリプト言語を使ってシナリオを作成できます。シナリオで音声認識や音声合成、プレゼンテーション画面の切り替え、お腹のボタンのコントロールなどができます。シナリオはブラウザベースのエディタを使って編集できます。特定のシナリオを電源投入時に自動的に実行することもできます。

### プレゼンテーション

おしゃべりと連携してプレゼンテーション画像を表示することができます。プレゼンテーション画面は Raspberry Pi のブラウザに表示されます。外部モニタを接続することで Raspberry Pi の画面を表示することができますので、外部のパソコンなしにロボット単体でプレゼンテーションができます。

## ロボットの設計図

設計図は 1.5mm 厚ダンボール用と 3mm 厚ダンボール用の２つがあります。
ロボットは設計図の各ページを A4 サイズで印刷して、厚紙パーツはそのまま切り取り、ダンボールパーツはダンボールに貼り付けて切り取ります。

- 3mm 厚ダンボール用

  [http://bit.ly/2LkGgn4](http://bit.ly/2LkGgn4)

- 1.5mm 厚ダンボール用

  [http://bit.ly/2mmmfBG](http://bit.ly/2mmmfBG)

設計図は[クリエイティブコモンズライセンス](https://creativecommons.org/)で公開しています。

ロボットの組立方法は以下のリンク先のページを参考にしてください。

- [ロボット組立方法](http://bit.ly/2zTPUfn)

### ハードウェアの構成について

もともとは、Google の [Voice Kit V1](https://aiyprojects.withgoogle.com/voice-v1/) を利用したロボットでした。現在は販売されていませんので、市販の部品を組み合わせることで作ることができます。詳しくは以下のリンクを参照してください。

[https://yamagame.github.io/dora-board/](https://yamagame.github.io/dora-board/)

### サーボモーターについて

ダンボールロボットの設計図はマイクロサーボを２つ使う設計になっています。一つは頭部を左右に、もう一つは上下に動かします。しかし、Servo MG90D の様なマイクロサーボは稼働させ続けると壊れやすい様です。長時間動かす場合はマイクロサーボではなく、MG996R の様な大きめのサーボをオススメします。

[秋月電子：TowerPro MG996R](http://akizukidenshi.com/catalog/g/gM-12534/)

MG996R ではダンボールロボットのサイズに合いませんので上下の動きは諦めて左右の動きのサーボとして使用します。

## 準備

[Raspberry Pi OS](https://www.raspberrypi.org/downloads/) から Raspberry Pi OS をダウンロードして microSD カードを作成します。Raspberry Pi Imager を使用すると選択画面から OS を選ぶことができます。

![Raspberry Pi Imager](./docs/images/raspi-os-imager.png)

OSは「Raspberry Pi OS (64-bit)」や「Raspberry Pi OS Lite (64-bit)」を選択します。メモリ使用量が少なくて済むので「Raspberry Pi OS Lite (64-bit)」がおすすめです。

Raspberry Pi のターミナルで、以下のコマンドを入力して、ロボットエンジンをダウンロードします。

```
$ cd ~
$ git clone https://github.com/yamagame/dora-engine.git
```

dora-engine フォルダに移動して、setup-system.sh を実行します。

```
$ cd dora-engine
$ ./setup-system.sh
```

setup-nodejs.sh で NodeJS をセットアップします。 NodeJS は v18.13.0 以上をインストールします。このドキュメントを記入した時点では Debian Bookworm で NodeJS をインストールすると v18.13.0 になるようです。

```
$ ./setup-nodejs.sh
```

NodeJS の準備ができたらビルドします。

```
$ yarn build
```

setup-open-jTalk.sh で Open JTalk をセットアップします。

```
$ ./setup-open-jTalk.sh
```

setup-autolaunch.sh で、自動起動の設定を行います。

```
$ ./setup-autolaunch.sh
```

再起動します。

### /boot/config.txt を編集する

I2S 接続の音声デバイスをりようする場合は以下の手順を進めます。dora-engine は I2S 接続の「MAX98357A」と「SPH0645LM4H」を利用することを前提として実装しています。

以下の項目をコメントアウトして無効化します。

```
#dtparam=audio=on
```

以下の３項目を記入して有効化します。

```
dtparam=i2s=on
dtoverlay=i2s-mmap
dtoverlay=googlevoicehat-soundcard
```

以下の行を編集して hdmi の音声出力を無効にします。

```
dtoverlay=vc4-kms-v3d,noaudio       # <== noaudio を追記
dtoverlay=dietpi-disable_hdmi_audio # <== 行追加
```

### /etc/asound.conf を作成

asound.confg を作成して、plug:softvol と plug:micboost デバイスを利用できるように設定します。

```
options snd_rpi_googlemihat_soundcard index=0

pcm.softvol {
    type softvol
    slave.pcm dmix
    control {
        name Master
        card 0
    }
}

pcm.micboost {
    type route
    slave.pcm dsnoop
    ttable {
        0.0 10
        1.1 10
    }
}

pcm.!default {
    type asym
    playback.pcm "plug:softvol"
    capture.pcm "plug:micboost"
}

ctl.!default {
    type hw
    card 0
}
```

### マイクとスピーカーをテストする

#### 録音する場合

```
$ arecord -Dplug:micboost -f S16_LE -r 16000 test.wav
```

#### 再生する場合

```
$ aplay -Dplug:softvol test.wav
```

### AquesTalk Pi の準備

デフォルトの音声合成である AquesTalk Pi を使用する場合は、以下の手順で準備します。

ブラウザで以下の URL を開きます。

[https://www.a-quest.com/products/aquestalkpi.html](https://www.a-quest.com/products/aquestalkpi.html)

Download のセクションから、使用許諾を読んで「同意して Download」ボタンをクリックします。

Downloads フォルダに aquestalkpi-20220207.tar がダウンロードされますので、以下のコマンドでダウンロードしたファイルを DoraEngine のプロジェクトルートの modules ディレクトリに移動して解凍します。

```
$ mv ~/Downloads/aquestalkpi-20220207.tar ./modules
$ pushd modules
$ tar xvf aquestalkpi-20220207.tar
$ popd
```

以下のスクリプトを実行して必要なモジュールをインストールします。

```
$ ./scripts/setup-rpi-64bit.sh
```

以下のコマンドを入力して、音声合成のテストを行います。

```
$ cd ~/dora-engine
$ ./talk-f1.sh こんにちは
```

### Open JTalk を有効にする

音声合成を Open JTalk に変更する場合は、[start-robot-server.sh](./start-robot-server.sh) の以下の行のコメントアウトを外します。

```
#export ROBOT_DEFAULT_VOICE=open-jTalk
```

再起動後、デフォルト音声合成が AquesTalk Pi になります。

## 音声認識

音声認識には以下の３つが選択可能です。

- [Web Speech API](https://developer.mozilla.org/ja/docs/Web/API/Web_Speech_API) (デフォルト)
- [ReazonSpeech](https://research.reazon.jp/projects/ReazonSpeech/index.html)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) 

ReazonSpeech、whisper.cpp で音声認識するには高性能なコンピュータが必要です。
また、音声の区間検出に pyannote を使用しているため、モデルのダウンロードに Hugging Face のトークンが必要です。
M1 Max 64G で動作確認しています。

- Hugging Face https://huggingface.co/

Hugging Face のトークンについてはこちらを参照。

- https://huggingface.co/docs/hub/security-tokens

### Chrome ブラウザの音声認識APIを使用する場合

```sh
# ロボットエンジンの起動
$ yarn start
```

```sh
# または環境変数を指定して起動
export SPEECH=browser
```

chrome ブラウザで http://localhost:3090/browser-speech を開きます。別のウインドウで http://localhost:3090/scenario-editor を開き、下記のスクリプトを実行します。

```sh
//オウム返し
:LOOP
/speech-to-text
/text-to-speech/{{speechText}}
/goto/:LOOP
```

初回はマイクの利用許可を求められますので許可します。ブラウザの音声認識を利用するにはインターネットが必要です。  
ブラウザの音声認識は chrome のみで機能します。音声認識できる時間は 15 秒間で 15 秒経つとタイムアウトします。

### ReazonSpeech による音声認識の場合

```sh
# reazonプロキシーの起動
# - python を使用するため、pip インストールなど環境の構築が必要です
$ export HUGGINGFACE_TOKEN=XXXXXXXXXXXXXXXXXXXXX # huggingface のトークンを指定
$ yarn asr:reazon

# ストリームモードで起動
$ yarn start:stream
```

### whisper.cpp による音声認識の場合

whisperモードを利用するためには whisper.cpp の server コマンドを同じコンピュータで実行しておく必要があります。

```sh
# whisper.cpp が提供している server コマンドを実行
$ ./server -m models/ggml-medium.bin
```

```sh
# whisperプロキシーの起動
# - python を使用するため、pip インストールなど環境の構築が必要です
$ export HUGGINGFACE_TOKEN=XXXXXXXXXXXXXXXXXXXXX # huggingface のトークンを指定
$ yarn asr:whisper

# ストリームモードで起動
$ yarn start:stream
```

## Webサーバ

dora-engine は Web サーバになっており、プレゼンテーション画面やシナリオエディタをホストしています。

### プレゼンテーション画面

<p align="center">
  <img style="border:solid 1px lightgray;" src="./images/presentation.png"/>
</p>

ブラウザで以下の URL を開きます。

    http://[dora-engineのIPアドレス]:3090/

この画面にコマンドで指示したスライドなどが表示されます。シナリオを作ることでスライドと連動したプレゼンテーションロボットとして稼働させることができます。

Chrome ブラウザで音声認識させる場合は以下の URL を開きます。

    http://locahost:3090/browser-speech

### シナリオエディター画面

<p align="center">
  <img style="border:solid 1px lightgray;" src="./images/scenario-editor.png"/>
</p>

シナリオエディターを使ってロボットをコントロールすることができます。

ブラウザで以下の URL を開きます。

    http://[dora-engineのIPアドレス]:3090/scenario-editor/

あなたのお名前のエリアに名前を入力します。名前はなんでもよいです。

テキストエディターが開きますので、そこに適当に会話文書を入力します。

## シナリオ言語仕様

特殊行以外はロボットが読み上げる文章です。空行は 1 秒のウエイトとして機能します。

下記はスライドをめくりながら解説するスクリプトの例です。

```
みなさん、こんにちは。
それでは、サイエンス講座を始めたいと思います。

今回は、夕焼けの話です。

/slide/images/sunset/002.jpeg

夕焼けは、日没の頃に西の空が赤く見える現象のことです。


/slide/images/sunset/003.jpeg

地球の大気は、太陽からの青いろの光を拡散する性質を持っています。
```

スクリプトの詳細は [DoraScript Language Specification](./docs/DORA-SCRIPT.md)
 を参照してください。

### コメント

行頭が//だとコメント行になります。

```
//ここはコメント
```

### コマンド

行頭が/から始まるとコマンド行になります。

```
/.payload/おはようございます
```

### ラベル

行頭が:から始まるとラベル行になります。

## 関連プロジェクト

### Dora Editor

[https://github.com/yamagame/dora-editor](https://github.com/yamagame/dora-editor)

### Dora Script Sample

[https://github.com/yamagame/dora-script-sample](https://github.com/yamagame/dora-script-sample)

### ドキュメント詳細

[https://yamagame.github.io/dora-engine-doc/](https://yamagame.github.io/dora-engine-doc/)

## ライセンス

[MIT](LICENSE)
