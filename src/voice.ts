import { VoiceEmitter } from "./voice-emitter"
import { spawn } from "child_process"
import { config } from "./config"
import { localhostToken } from "./access-check"
import * as path from "path"
import { Log } from "~/logger"

const macvoice_speedrate = 210 / 100
const axios = require("axios")
const { basedir } = config

const headers = {
  "Content-Type": "application/json",
}

export class Voice extends VoiceEmitter {
  constructor() {
    super()
  }

  _say(words: string, params, callback, startCallback) {
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
        ? this.robot_voice === "mac"
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
      Log.info(text, `languageCode:${languageCode}`, `robot_voice:${this.robot_voice}`)
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
      } else if (languageCode === "default" || languageCode === "normal" || !languageCode) {
        // 通常モードの発話処理
        if (this.robot_voice === "dummy") {
          playone()
        } else if (this.robot_voice === "mac") {
          Log.info("macvoice", languageCode)
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
        } else {
          if (voice == "marisa") {
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
          }
        }
      } else if (languageCode) {
        // open-jtalk / google text-to-speech / aws poly の場合
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
}

export function Talk() {
  return new Voice()
}

function main() {
  const talk = Talk()
  talk.robot_voice = "mac"
  talk.languageCode = "normal"
  talk.play("こんにちは")
}

if (require.main === module) {
  main()
}
