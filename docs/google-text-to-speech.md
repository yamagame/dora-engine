# Google CLOUD TEXT-TO-SPEECHに対応する

Google CLOUD TEXT-TO-SPEECHについては、下記のURLを参照。

[https://cloud.google.com/text-to-speech/](https://cloud.google.com/text-to-speech/)

### 環境変数の設定

下記のURLの記事に従ってcredentials.jsonを取得します。

[https://cloud.google.com/text-to-speech/docs/quickstart-client-libraries](https://cloud.google.com/text-to-speech/docs/quickstart-client-libraries)

取得したcredentials.jsonを環境変数GOOGLE_APPLICATION_CREDENTIALSに設定します。

下記は設定例です。

```
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/robot/google-text-to-speech-credentials.json
```

### ドラスクリプトで喋らせる

.speech.languageCodeにja-JPを指定すると日本語で話します。

```
/.speech.languageCode/ja-JP
こんにちは
```

.speech.languageCodeにen-USを指定すると英語で話します。

```
/.speech.languageCode/en-US
HELLO
```

languageCodeについては下記のURLを参照。

[https://cloud.google.com/text-to-speech/docs/voices](https://cloud.google.com/text-to-speech/docs/voices)

元に戻すには以下の様にします。

```
/.speech.languageCode
こんにちは
```

### その他のパラメータ

```
//性別を指定します MALE/FEMALE/NEUTRAL
/.speech.gender/FEMALE
//0.25 〜 4.0の間でスピードを指定します。1がデフォルトです。
/.speech.rate/1
//-20 〜 20の間でピッチを指定します。0がデフォルトです。
/.speech.pitch/5
//ボイス名で指定します。
/.speech.name/en-US-Wavenet-C
```
