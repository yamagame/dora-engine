# Dora Engine

ラズベリーパイとVoiceKitで作るコミュニケーションロボット用エンジンです。
プログラムはNode.jsで動作します。

## 機能

- [Speech-to-Text Client Libraries](https://cloud.google.com/speech-to-text/docs/reference/libraries) を使って音声認識ができます。
- [AquesTalk Pi](https://www.a-quest.com/products/aquestalkpi.html) を使って音声合成ができます。他の音声合成エンジンに変更することもできます。
- サーボ２つで、ロボットの頭部を２軸動作できます。
- Node-REDとの連携でコントロールできます。
- 専用スクリプト(DoraScript)を使ってブラウザ経由でコントロールできます。
- 自動プレゼンテーション機能
- 音声認識によるQ&A機能
- [ドコモ雑談対話](https://dev.smt.docomo.ne.jp/?p=docs.api.page&api_name=dialogue&p_name=api_reference)に対応しています

## 準備

SDカードを作成します。OSイメージは(他のイメージだとボリュームコントロールがうまく行かなかったので)Google Voice Kitの2017/09/11バージョンを使用します。

[https://dl.google.com/dl/aiyprojects/voice/aiyprojects-2017-09-11.img.xz](https://dl.google.com/dl/aiyprojects/voice/aiyprojects-2017-09-11.img.xz)

ラズベリーパイのターミナルで、以下のコマンドを入力して、ロボットエンジンをダウンロードします。

```
$ cd ~
$ git clone https://github.com/yamagame/dora-engine
```

dora-engineフォルダに移動して、setup-system.shを実行します。

```
$ cd dora-engine
$ ./setup-system.sh
```

setup-nodejs.shでNode.jsをセットアップします。

```
$ ./setup-nodejs.sh
```

setup-node-red.shでNode-REDをセットアップします。

```
$ ./setup-node-red.sh
```

setup-autolaunch.shで、自動起動の設定を行います。

```
$ ./setup-autolaunch.sh
```

再起動します。

## AquesTalk Piの準備

ブラウザで以下のURLを開きます。

[https://www.a-quest.com/products/aquestalkpi.html](https://www.a-quest.com/products/aquestalkpi.html)

Downloadのセクションから、使用許諾を読んで「同意してDownload」ボタンをクリックします。

Downloadsフォルダにファイルがダウンロードされますので、以下のコマンドを入力して解凍します。

```
$ cd ~/Downloads
$ tar xvf aquestalkpi-20130827.tgz 
```

以下のコマンドを入力して、音声合成のテストを行います。

```
$ cd ~/dora-engine
$ talk-f1.sh こんにちは
```

## Google Speech APIの準備

下記のページにしたがって準備します。google-cloud-sdkのインストールは、setup-system.shですでにインストールしていますので不要です。SDKの初期化のセクションから進めます。

[https://cloud.google.com/sdk/docs/quickstart-debian-ubuntu](https://cloud.google.com/sdk/docs/quickstart-debian-ubuntu)

以下のコマンドを実行して、メッセージにしたがって設定します。

```
$ gcloud init
```

以下のコマンドを実行して、作成したプロジェクトをデフォルトプロジェクトに設定します。

```
$ export GCLOUD_PROJECT=[作成したプロジェクトID]
$ gcloud auth application-default login
```

音声認識のテストを行います。以下のコマンドを入力して、マイクに向かって話します。話した言葉がテキスト化されれば成功です。

```
$ cd ~/dora-engine
$ node speech.js
```

## docomo雑談対話APIの準備

[docomo Developer support](https://dev.smt.docomo.ne.jp/?p=docs.api.page&api_name=dialogue&p_name=api_reference) のページから、雑談対話のAPIキーを取得して、環境変数 DOCOMO_API_KEY に設定します。

```
export DOCOMO_API_KEY=7570304351643...................
```

## DoraEditorの使い方

ブラウザで以下のURLを開きます。

```
http://localhost:3090/scenario-editor/
```

あなたのお名前のエリアに名前を入力します。名前はなんでもよいです。

テキストエディターが開きますので、そこに適当に会話文書を入力します。

## 関連プロジェクト

### Dora Script
[https://github.com/yamagame/dora](https://github.com/yamagame/dora)

### Dora Editor
[https://github.com/yamagame/dora-editor](https://github.com/yamagame/dora-editor)

### Dora Admin
[https://github.com/yamagame/dora-admin](https://github.com/yamagame/dora-admin)

### Dora Quiz
[https://github.com/yamagame/dora-quiz](https://github.com/yamagame/dora-quiz)

### Dora Script Sample
[https://github.com/yamagame/dora-script-sample](https://github.com/yamagame/dora-script-sample)

## ライセンス

[MIT](LICENSE)
