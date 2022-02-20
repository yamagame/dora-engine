const EventEmitter = require("events");
const spawn = require("child_process").spawn;
const path = require("path");
const macvoice_speedrate = 180 / 100;
const config = require("./config");
const request = require("request");
const { localhostToken } = require("./accessCheck");
const utils = require("./utils");

function Talk() {
  var t = new EventEmitter();
  t.playQue = [];
  t.playing = false;
  t.voice = "reimu";
  t.speed = 95;
  t.volume = 80;
  t.dummy = false;
  t.macvoice = false;
  t.languageCode = null;
  t.audioEncoding = null;
  t.ssmlGender = null;
  t.speakingRate = null;
  t.pitch = null;
  t.name = null;
  t._playone = null;

  t.say = function (words, params, callback, startCallback) {
    if (typeof words === "undefined") {
      callback();
      return;
    }
    const voice = params.voice;
    const speed = params.speed;
    const volume = params.volume;
    const languageCode = params.languageCode;
    const audioEncoding = params.audioEncoding;
    const ssmlGender = params.ssmlGender;
    const speakingRate = params.speakingRate;
    const pitch = params.pitch;
    const name = params.name;
    const conts =
      ["default", "", null].indexOf(languageCode) >= 0
        ? words.split(/\n|,|、|。|@|＠|？|\s|\?/g)
        : [words];
    const playone = () => {
      if (conts.length <= 0 || this.playing === false) {
        this._playone = null;
        callback();
        return;
      }
      const text = conts.shift();
      if (text == "") {
        playone();
        return;
      }
      console.log(text);
      if ("host" in params) {
        const p = { ...params };
        delete p.host;
        this._playone = `http://${params.host}:${config.port}/text-to-speech`;
        request(
          {
            uri: this._playone,
            method: "POST",
            json: p,
          },
          function (error, response, body) {
            playone();
          }
        );
      } else if (
        languageCode === "default" ||
        //|| languageCode === 'open-jTalk'
        languageCode === null
      ) {
        if (this.dummy) {
          playone();
        } else if (this.macvoice) {
          if (languageCode === "open-jTalk") {
            startCallback();
            this._playone = spawn(
              path.join(__dirname, "talk-open-jTalk-mac.sh"),
              [voice === "reimu" ? "mei_normal" : voice, `${text}`]
            );
            this._playone.on("close", function (code) {
              playone();
            });
          } else {
            startCallback();
            this._playone = spawn(path.join(__dirname, "talk-mac.sh"), [
              `-r`,
              speed * macvoice_speedrate,
              text,
              voice === "reimu" ? "" : voice || "",
            ]);
            this._playone.on("close", function (code) {
              playone();
            });
          }
        } else {
          if (languageCode === "open-jTalk") {
            startCallback();
            this._playone = spawn(
              path.join(__dirname, "talk-open-jTalk-raspi.sh"),
              [voice === "reimu" ? "mei_normal" : voice, `${text}`]
            );
            this._playone.on("close", function (code) {
              playone();
            });
          } else {
            if (voice == "marisa") {
              startCallback();
              this._playone = spawn(path.join(__dirname, "talk-f2.sh"), [
                `-s`,
                speed,
                `-g`,
                volume,
                `　${text}`,
              ]);
              this._playone.on("close", function (code) {
                playone();
              });
            } else {
              startCallback();
              this._playone = spawn(path.join(__dirname, "talk-f1.sh"), [
                `-s`,
                speed,
                `-g`,
                volume,
                `　${text}`,
              ]);
              this._playone.on("close", function (code) {
                playone();
              });
            }
          }
        }
      } else if (languageCode) {
        const params = {
          text,
          localhostToken: localhostToken(),
        };
        if (languageCode) params.languageCode = languageCode;
        if (audioEncoding) params.audioEncoding = audioEncoding;
        if (ssmlGender) params.ssmlGender = ssmlGender;
        if (speakingRate !== null) params.speakingRate = speakingRate;
        if (pitch !== null) params.pitch = pitch;
        if (name) params.name = name;
        this._playone = `http://localhost:${config.port}/google`;
        //音声データのダウンロードのみ
        request(
          {
            uri: `${this._playone}/init-text-to-speech`,
            method: "POST",
            json: params,
          },
          (error, response, body) => {
            startCallback();
            //音声の再生
            request(
              {
                uri: `${this._playone}/text-to-speech`,
                method: "POST",
                json: params,
              },
              (error, response, body) => {
                playone();
              }
            );
          }
        );
      } else {
        playone();
      }
    };
    playone();
  };

  t.playAsync = function (speech, params, callback) {
    return new Promise(resolve => {
      let doneStart = false;
      this.say(
        speech,
        params,
        () => {
          resolve(null, "OK");
        },
        () => {
          if (!doneStart) {
            if (callback) callback("talk");
          }
          doneStart = true;
        }
      );
    });
  };

  t.play = function (sentence, params = {}, callback) {
    //デフォルトパラメータの設定
    {
      if (typeof params.voice === "undefined") params.voice = t.voice;
      if (typeof params.speed === "undefined") params.speed = t.speed;
      if (typeof params.volume === "undefined") params.volume = t.volume;
      if (typeof params.languageCode === "undefined")
        params.languageCode = t.languageCode;
      if (typeof params.audioEncoding === "undefined")
        params.audioEncoding = t.audioEncoding;
      if (typeof params.ssmlGender === "undefined")
        params.ssmlGender = t.ssmlGender;
      if (typeof params.speakingRate === "undefined")
        params.speakingRate = t.speakingRate;
      if (typeof params.pitch === "undefined") params.pitch = t.pitch;
      if (typeof params.name === "undefined") params.name = t.name;
    }
    this.emit("talk");
    if (!this.playing) {
      this.playing = true;
      const _play = sentence => {
        this.playAsync(sentence, params, callback).then(() => {
          if (this.playQue.length > 0 && this.playing !== false) {
            const sentence = this.playQue.shift();
            _play(sentence);
          } else {
            this.playQue = [];
            this.playing = false;
            this.emit("idle");
            if (callback) callback("idle");
          }
        });
      };
      _play(sentence);
    } else {
      this.playQue.push(sentence);
    }
  };

  t.stop = function (callback) {
    this.playing = false;
    if (this._playone) {
      if (typeof this._playone === "string") {
        request(
          {
            uri: `${this._playone}/text-to-speech`,
            method: "POST",
            json: {
              action: "stop",
              localhostToken: localhostToken(),
            },
          },
          function (error, response, body) {
            if (callback) callback();
          }
        );
        this._playone = null;
        return;
      } else {
        utils.kill(this._playone.pid, "SIGTERM", function () {});
      }
    }
    this._playone = null;
    if (callback) callback();
  };

  t.flush = function () {
    this.playing = false;
    this.playQue = [];
  };

  return t;
}

module.exports = Talk();
