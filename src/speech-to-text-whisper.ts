import * as EventEmitter from "events"
const { spawn } = require("child_process")

const WHISPER = process.env["WHISPER_PATH"] || "./whisper.sh"
console.log(`WHISPER_PATH ${WHISPER}`)

class SpeechEmitter extends EventEmitter {
  writing = false
  recording = false
  constructor() {
    super()
  }
}

function Speech() {
  var t = new SpeechEmitter()
  var streamDataReuest = false
  var startRecording = false

  let resultSpeech = []
  let commingText = ""
  const maxResult = 10

  let childProcess = null

  const isSpeech = (text) => {
    if (text.length > 0 && text[0] !== "(" && text[0] !== "[") return true
    return false
  }

  // マイクの音声認識の閾値を変更
  t.on("mic_threshold", function (threshold) {
    // ignore
  })

  // 音声解析開始
  t.on("startRecording", function (params) {
    const { threshold, languageCode, alternativeLanguageCodes, level } = params
    if (!startRecording) {
      if (childProcess == null) {
        childProcess = spawn(WHISPER)
        childProcess.stdout.on("data", (chunk) => {
          if (!startRecording) return
          const getText = (chunk) => {
            const s = chunk.toString()
            const h = Buffer.from(s, "utf8").toString("hex")
            const m = h.match(/^1b5b324b(.+)1b5b324b(.+)$/)
            if (m) {
              return Buffer.from(m[2], "hex").toString("utf-8")
            }
            return s
          }
          const text = getText(chunk).trim()
          resultSpeech.push(text)
          resultSpeech = resultSpeech.splice(-maxResult)
          if (isSpeech(text)) {
            const transcript = text
            let candidate = {
              confidence: 0,
              transcript,
            }
            const emitResult = (result) => {
              console.log(`result ${JSON.stringify(result, null, "  ")}`)
              t.emit("data", result)
              if (!t.writing) {
                t.recording = false
              }
            }
            emitResult(candidate)
            // t.emit("data", { transcript: text });
          }
        })
      }
      startRecording = true
    }
    if (childProcess) {
      console.log("<<start>>")
      childProcess.stdin.write("start\n")
    }
    commingText = ""
  })

  // 音声解析終了
  t.on("stopRecording", function () {
    console.log("stopRecording")
    if (childProcess) {
      console.log("<<stop>>")
      childProcess.stdin.write("stop\n")
    }
  })

  //解析用ストリームデータを送信開始
  t.on("startStreamData", function () {
    streamDataReuest = true
  })

  //解析用ストリームデータを送信停止
  t.on("stopStreamData", function () {
    streamDataReuest = false
  })

  return t
}

const sp = Speech()
module.exports = sp

if (require.main === module) {
  const express = require("express")
  const socketIO = require("socket.io")
  const PORT = 4300

  const app = express()

  const server = require("http").Server(app)
  server.listen(PORT, () => console.log(`server listening on port ${PORT}!`))

  sp.emit("startRecording", {})
}
