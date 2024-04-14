import { EventEmitter } from "events"
import { ChildProcess } from "child_process"

import { localhostToken } from "./access-check"

const axios = require("axios")
const utils = require("./utils")

const headers = {
  "Content-Type": "application/json",
}

export class VoiceEmitter extends EventEmitter {
  playQue: any[] = []
  playing: boolean = false
  voice: string = "reimu"
  speed: number = 95
  volume: number = 80
  robot_voice: string = null
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

  _say(words: string, params, callback, startCallback) {}

  _playAsync(speech: string, params, callback) {
    return new Promise<void>((resolve) => {
      let doneStart = false
      this._say(
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
    callback = null
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
        this._playAsync(sentence, params, callback).then(() => {
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

  stop(callback = null) {
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
