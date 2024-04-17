import * as fs from "fs"
import { RecordingEmitter } from "./recording-emitter"
import { Mic } from "./voice/mic"
import { Log } from "~/logger"
const SAMPLE_RATE_HERTZ = 16000
const defaultRequestOpts = {
  config: {
    encoding: "LINEAR16",
    sampleRateHertz: SAMPLE_RATE_HERTZ,
    languageCode: "ja-JP",
    alternativeLanguageCodes: null,
    maxAlternatives: 3,
  },
  interimResults: false,
}

const timestamp = () => {
  const now = new Date()
  return now.getTime()
}

class GoogleSpeechRecordingEmitter extends RecordingEmitter {
  recording = false
  writing = false
  _preloadRecording = false
  recordingTime = 0
  state = "recoding-stop"
  status = ""
  setParams = (any) => {}

  constructor() {
    super()
  }
}

class TimeoutTimer {
  timer: NodeJS.Timeout = null

  clear() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  start(callback: () => void, ms: number) {
    this.clear()
    this.timer = setTimeout(() => {
      this.timer = null
      if (callback) callback()
    }, ms)
  }
}

class SpeechStream {
  stream = null
  filename = null

  isActive() {
    return this.stream != null
  }

  clear() {
    this.stream = null
    this.filename = null
  }
}

function Speech() {
  const speechEmitter = new GoogleSpeechRecordingEmitter()

  const mic = new Mic({
    rate: "16000",
    channels: "1",
    debug: false,
    exitOnSilence: 0,
    encoding: "signed-integer",
    fileType: "raw",
    endian: "little",
    // audioStream: fs.createWriteStream("./work/recording.raw"),
    // audioStream: new PassThrough(),
  })

  const speechStream = new SpeechStream()
  let streamQue = []
  let requestOpts = { ...defaultRequestOpts }

  const speech = require("@google-cloud/speech")
  const googleSpeechClient = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? new speech.SpeechClient()
    : null

  // 認識結果を返す
  const emitResult = (result) => {
    // Log.info(`result ${JSON.stringify(result, null, "  ")}`)
    speechEmitter.emit("data", result)
  }

  // 認識エラーを返す
  const emitError = (err) => {
    const result = {
      languageCode: requestOpts.config.languageCode,
      errorString: err.toString(),
      transcript: "error",
      confidence: 0,
      payload: "error",
    }
    // Log.info(`error ${JSON.stringify(result, null, "  ")}`)
    speechEmitter.emit("data", result)
  }

  const writing_timer = new TimeoutTimer()

  // 音声検出後、1sの遊びを設ける
  const writing_timeout = () => {
    writing_timer.clear()
    if (!speechEmitter.writing) {
      return
    }
    writing_timer.start(() => {
      speechEmitter.writing = false
      if (googleSpeechClient) {
        end_recording(true)
      } else {
        const filename = speechStream.filename
        end_recording()
        emitResult({
          filename,
        })
      }
      Log.info("writing_timeout")
    }, 1000)
  }

  const start_recording = () => {
    mic.startRecording()
    speechEmitter.recording = true
    streamQue = []
  }

  const end_recording = (mode = false) => {
    mic.stopRecording()
    if (!mode) {
      speechEmitter.recording = false
    }
    writing_timer.clear()
    if (speechStream.isActive()) {
      Log.info("end_stream")
      speechStream.stream.end()
      speechStream.clear()
    }
  }

  // 認識ストリームの作成 GOOGLE_APPLICATION_CREDENTIALS が未設定の場合はファイル書き出し
  const genStream = (props: { fname: string }) => {
    Log.info("genStream", requestOpts)
    if (googleSpeechClient) {
      Log.info("new google speech stream")
      return googleSpeechClient
        .streamingRecognize(requestOpts)
        .on("error", (err) => {
          // console.error(err, JSON.stringify(opts))
          if (!speechEmitter.recording) return
          end_recording()
          speechEmitter.writing = false
          emitError(err)
        })
        .on("data", (data) => {
          // Log.info(JSON.stringify(data, null, "  "))
          if (!speechEmitter.recording) return
          end_recording()
          let candidate = {
            confidence: 0,
            languageCode: "",
          }
          if (data.results) {
            data.results.forEach((result) => {
              const languageCode = result.languageCode
              result.alternatives.forEach((alt) => {
                if (candidate.confidence < alt.confidence) {
                  candidate = alt
                  candidate.languageCode = languageCode
                }
              })
            })
          }
          emitResult(candidate)
        })
    } else {
      Log.info("new file stream")
      return fs.createWriteStream(props.fname)
    }
  }

  // 音声区間検出
  mic.on("voice_start", () => {
    Log.info("writing_start")
    if (!speechStream.isActive()) {
      const fname = `./work/output-${timestamp()}.raw`
      if (!googleSpeechClient) {
        Log.info("writing...", fname)
      }
      speechStream.stream = genStream({ fname })
      speechStream.filename = fname
    }
    speechEmitter.writing = true
    writing_timer.clear()
  })

  // 無音区間検出
  mic.on("voice_stop", () => {
    Log.info("writing_stop")
    writing_timeout()
  })

  // 音声データ受信
  mic.on("data", (raw) => {
    if (speechEmitter.writing && speechEmitter.recording) {
      speechEmitter.writing = true
      if (speechStream.isActive()) {
        if (streamQue.length > 0) {
          streamQue.forEach((raw) => {
            speechStream.stream.write(raw)
          })
          streamQue = []
        }
        speechStream.stream.write(raw)
      }
    }
  })

  // マイクの音声認識の閾値を変更
  speechEmitter.on("mic_threshold", (threshold) => {
    //
  })

  // 音声解析開始
  speechEmitter.on("startRecording", async (params) => {
    Log.info("startRecording", params)
    start_recording()
    const opts = { ...defaultRequestOpts }

    let alternativeLanguageCodes = {}
    // alternativeLanguageCodes による指定
    if ("alternativeLanguageCodes" in params) {
      if (params.alternativeLanguageCodes) {
        const t = params.alternativeLanguageCodes.trim().split("/")
        t.forEach((code) => {
          alternativeLanguageCodes[code.trim()] = true
        })
      }
    }
    // languageCode による指定
    if ("languageCode" in params) {
      if (typeof params.languageCode === "string") {
        opts.config.languageCode = params.languageCode.trim()
      } else {
        params.languageCode.forEach((code, i) => {
          if (i == 0) {
            opts.config = { ...defaultRequestOpts.config }
            opts.config.languageCode = code.trim()
          } else {
            alternativeLanguageCodes[code.trim()] = true
          }
        })
      }
    }
    if (Object.keys(alternativeLanguageCodes).length > 0) {
      opts.config.alternativeLanguageCodes = [...Object.keys(alternativeLanguageCodes)]
    }

    requestOpts = opts
    Log.info("#", "startRecording", mic.isRecording())
  })

  // 音声解析停止
  speechEmitter.on("stopRecording", async () => {
    end_recording()
    Log.info("#", "stopRecording")
  })

  return speechEmitter
}

export default Speech

////////////////////////////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////////////////////////////

function micRecorder() {
  const sp = Speech()
  const startRecording = () => {
    setTimeout(() => {
      sp.emit("startRecording", {
        languageCode: ["ja-JP", "en-US"],
      })
    }, 1000)
  }
  sp.on("data", (payload) => {
    Log.info(payload)
    startRecording()
  })
  startRecording()
}

function main() {
  micRecorder()
}

if (require.main === module) {
  main()
}
