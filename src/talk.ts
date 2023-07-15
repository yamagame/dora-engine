import * as EventEmitter from "events"
import { spawn, ChildProcess } from "child_process"
const path = require("path")
const macvoice_speedrate = 210 / 100
const config = require("./config")
const axios = require("axios")
const { localhostToken } = require("./accessCheck")
const utils = require("./utils")

const headers = {
  "Content-Type": "application/json",
}

const basedir = path.join(__dirname, "..")

class TalkEmitter extends EventEmitter {
  playQue: any[] = []
  playing: boolean = false
  voice: string = "reimu"
  speed: number = 95
  volume: number = 80
  dummy: boolean = false
  macvoice: boolean = false
  languageCode?: string
  audioEncoding?: string
  ssmlGender?: string
  speakingRate?: string
  pitch?: string
  name?: string
  _playone?: string | ChildProcess

  constructor() {
    super()
  }

  say(words, params, callback, startCallback) {
    if (typeof words === "undefined") {
      callback()
      return
    }
    const voice = params.voice
    const speed = params.speed
    const volume = params.volume
    const languageCode = params.languageCode
    const audioEncoding = params.audioEncoding
    const ssmlGender = params.ssmlGender
    const speakingRate = params.speakingRate
    const pitch = params.pitch
    const voiceId = params.voiceId
    const name = params.name
    const conts =
      ["default", "", null].indexOf(languageCode) >= 0
        ? this.macvoice
          ? words.split(/\n|。|@|＠|？|\?/g)
          : words.split(/\n|,|。|@|＠|？|\s|\?/g)
        : [words]
    const playone = () => {
      if (conts.length <= 0 || this.playing === false) {
        this._playone = null
        callback()
        return
      }
      const text = conts.shift()
      if (text == "") {
        playone()
        return
      }
      console.log(text)
      if ("host" in params) {
        // 発話の中継処理
        const p = { ...params }
        delete p.host
        this._playone = `http://${params.host}:${config.port}/text-to-speech`
        axios
          .post(
            this._playone,
            {
              ...p,
            },
            { headers }
          )
          .then(function (response) {
            playone()
          })
          .catch(function (error) {
            console.error(error)
          })
      } else if (
        languageCode === "default" ||
        languageCode === "normal" ||
        //|| languageCode === 'open-jTalk'
        languageCode === null
      ) {
        // 通常モードの発話処理
        if (this.dummy) {
          playone()
        } else if (this.macvoice) {
          if (languageCode === "open-jTalk") {
            startCallback()
            this._playone = spawn(path.join(basedir, "talk-open-jTalk-mac.sh"), [
              voice === "reimu" ? "mei_normal" : voice,
              `${text}`,
            ])
            this._playone.on("close", function (code) {
              playone()
            })
          } else {
            startCallback()
            this._playone = spawn(path.join(basedir, "talk-mac.sh"), [
              `-r`,
              speed * macvoice_speedrate,
              text,
              voice === "reimu" ? "" : voice || "",
            ])
            this._playone.on("close", function (code) {
              playone()
            })
          }
        } else {
          if (languageCode === "open-jTalk") {
            startCallback()
            this._playone = spawn(path.join(basedir, "talk-open-jTalk-raspi.sh"), [
              voice === "reimu" ? "mei_normal" : voice,
              `${text}`,
            ])
            this._playone.on("close", function (code) {
              playone()
            })
          } else {
            if (voice == "reimu") {
              startCallback()
              this._playone = spawn(path.join(basedir, "talk-f1.sh"), [
                `-s`,
                speed,
                `-g`,
                volume,
                `　${text}`,
              ])
              this._playone.on("close", function (code) {
                playone()
              })
            } else if (voice == "marisa") {
              startCallback()
              this._playone = spawn(path.join(basedir, "talk-f2.sh"), [
                `-s`,
                speed,
                `-g`,
                volume,
                `　${text}`,
              ])
              this._playone.on("close", function (code) {
                playone()
              })
            } else {
              startCallback()
              this._playone = spawn(path.join(basedir, "talk.sh"), [
                `-s`,
                speed,
                `-g`,
                volume,
                `${text}`,
                voice === "reimu" ? "" : voice || "",
              ])
              this._playone.on("close", function (code) {
                playone()
              })
            }
          }
        }
      } else if (languageCode) {
        // 言語指定の発話処理(google-router.jsへリクエスト)
        const params = {
          text,
          localhostToken: localhostToken(),
          languageCode: "",
          audioEncoding: "",
          ssmlGender: "",
          speakingRate: "",
          pitch: "",
          voiceId: "",
          name: "",
        }
        if (languageCode) params.languageCode = languageCode
        if (audioEncoding) params.audioEncoding = audioEncoding
        if (ssmlGender) params.ssmlGender = ssmlGender
        if (speakingRate !== null) params.speakingRate = speakingRate
        if (pitch !== null) params.pitch = pitch
        if (voiceId !== null) params.voiceId = voiceId
        if (name) params.name = name
        this._playone = `http://localhost:${config.port}/google`
        const playSpeech = () => {
          startCallback()
          //音声の再生
          axios
            .post(
              `${this._playone}/text-to-speech`,
              {
                ...params,
              },
              { headers }
            )
            .then(function (response) {
              playone()
            })
            .catch(function (error) {
              console.error(error)
            })
        }
        //音声データのダウンロードのみ
        axios
          .post(
            `${this._playone}/init-text-to-speech`,
            {
              ...params,
            },
            { headers }
          )
          .then(function (response) {
            playSpeech()
          })
          .catch(function (error) {
            console.error(error)
          })
      } else {
        playone()
      }
    }
    playone()
  }

  playAsync(speech, params, callback) {
    return new Promise<void>((resolve) => {
      let doneStart = false
      this.say(
        speech,
        params,
        () => {
          resolve()
        },
        () => {
          if (!doneStart) {
            if (callback) callback("talk")
          }
          doneStart = true
        }
      )
    })
  }

  play(
    sentence,
    params: {
      voice?: string
      speed?: number
      volume?: number
      languageCode?: string
      audioEncoding?: string
      ssmlGender?: string
      speakingRate?: string
      pitch?: string
      name?: string
    } = {},
    callback
  ) {
    //デフォルトパラメータの設定
    {
      if (typeof params.voice === "undefined") params.voice = this.voice
      if (typeof params.speed === "undefined") params.speed = this.speed
      if (typeof params.volume === "undefined") params.volume = this.volume
      if (typeof params.languageCode === "undefined") params.languageCode = this.languageCode
      if (typeof params.audioEncoding === "undefined") params.audioEncoding = this.audioEncoding
      if (typeof params.ssmlGender === "undefined") params.ssmlGender = this.ssmlGender
      if (typeof params.speakingRate === "undefined") params.speakingRate = this.speakingRate
      if (typeof params.pitch === "undefined") params.pitch = this.pitch
      if (typeof params.name === "undefined") params.name = this.name
    }
    this.emit("talk")
    if (!this.playing) {
      this.playing = true
      const _play = (sentence) => {
        this.playAsync(sentence, params, callback).then(() => {
          if (this.playQue.length > 0 && this.playing !== false) {
            const sentence = this.playQue.shift()
            _play(sentence)
          } else {
            this.playQue = []
            this.playing = false
            this.emit("idle")
            if (callback) callback("idle")
          }
        })
      }
      _play(sentence)
    } else {
      this.playQue.push(sentence)
    }
  }

  stop(callback) {
    this.playing = false
    if (this._playone) {
      if (typeof this._playone === "string") {
        axios
          .post(
            `${this._playone}/text-to-speech`,
            {
              action: "stop",
              localhostToken: localhostToken(),
            },
            { headers }
          )
          .then(function (response) {
            if (callback) callback()
          })
          .catch(function (error) {
            console.error(error)
          })
        this._playone = null
        return
      } else {
        utils.kill(this._playone.pid, "SIGTERM", function () {})
      }
    }
    this._playone = null
    if (callback) callback()
  }

  flush() {
    this.playing = false
    this.playQue = []
  }
}

function Talk() {
  var t = new TalkEmitter()
  return t
}

module.exports = Talk()
