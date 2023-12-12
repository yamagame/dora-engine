import { RecordingEmitter } from "./recording-emitter"
import { spawn } from "child_process"
import { Log } from "~/logger"

const WHISPER = process.env["WHISPER_PATH"] || "./whisper.sh"

class SpeechEmitter extends RecordingEmitter {
  writing = false
  recording = false
  constructor() {
    super()
  }
}

function Speech() {
  Log.info(`WHISPER_PATH ${WHISPER}`)

  const t = new SpeechEmitter()
  let streamDataReuest = false
  let startRecording = false

  let resultSpeech = []
  let commingText = ""
  const maxResult = 10

  let childProcess = null

  const isSpeech = (text) => {
    if (text.indexOf("ご視聴ありがとうございました") >= 0) return false
    if (text === "あっ" || text === "ん") return false
    if (text.length > 0 && text[0] !== "(" && text[0] !== "[") return true
    return false
  }

  // マイクの音声認識の閾値を変更
  t.on("mic_threshold", function (_threshold) {
    // ignore
  })

  // 音声解析開始
  t.on("startRecording", function (_params) {
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
              Log.info(`result ${JSON.stringify(result, null, "  ")}`)
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
      Log.info("<<start>>")
      // childProcess.stdin.write("start\n")
    }
    commingText = ""
  })

  // 音声解析終了
  t.on("stopRecording", function () {
    Log.info("stopRecording")
    if (childProcess) {
      Log.info("<<stop>>")
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

export default Speech

////////////////////////////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////////////////////////////

function main() {
  const sp = Speech()

  const express = require("express")
  const PORT = 4300

  const app = express()

  const server = require("http").Server(app)
  server.listen(PORT, () => Log.info(`server listening on port ${PORT}!`))

  sp.emit("startRecording", {})
}

if (require.main === module) {
  main()
}
