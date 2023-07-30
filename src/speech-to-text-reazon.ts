import * as fs from "fs"
import * as path from "path"
import * as dayjs from "dayjs"
import * as EventEmitter from "events"
import { Recorder } from "~/voice/recorder"
import { Logger } from "~/logger"
import { ulid } from "ulid"
import { sampleToWavAudio, audioSettings } from "~/voice/wav"

const REAZONSPEECH_HOST = process.env["REAZONSPEECH_HOST"] || "http://127.0.0.1:9002"
const REAZONSPEECH_WORK = process.env["REAZONSPEECH_WORK"] || "./work"
const REAZONSPEECH_RAW = process.env["REAZONSPEECH_RAW"] || ""
const REAZONSPEECH_LOGFILE = process.env["REAZONSPEECH_LOGFILE"] || ""

const logger = new Logger({ outdir: REAZONSPEECH_WORK, logfile: REAZONSPEECH_LOGFILE })

const timeform = "YYYY/MM/DD hh:mm:ss"

const rawfile = REAZONSPEECH_RAW
const rawprop: { rawfile?: string } = {}
if (rawfile != "") {
  rawprop.rawfile = `${path.basename(rawfile, path.extname(rawfile))}-${ulid()}${path.extname(
    rawfile
  )}`
}

class RecordingEmitter extends EventEmitter {
  constructor() {
    super()
  }
}

function Speech() {
  const t = new RecordingEmitter()

  const recorder = new Recorder()

  recorder.on("voice_stop", () => {
    logger.print("voice_stop")
  })
  recorder.on("voice_start", () => {
    logger.print("voice_start")
  })
  recorder.on("transcribe", async (event) => {
    const buffer = event.data
    const wavdata = sampleToWavAudio(
      buffer,
      new audioSettings({
        sampleSize: 16,
        sampleRate: 48000,
        channelCount: 1,
      })
    )
    const filename = `${logger.filename()}.wav`
    const fpath = path.join(REAZONSPEECH_WORK, filename)
    fs.writeFile(fpath, wavdata, (err) => {
      if (err) throw err
    })
    logger.print("start_transcribe")
    const res = await fetch(`${REAZONSPEECH_HOST}/wav/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    })
    const data = await res.json()
    logger.clearLine()
    logger.log({
      timestamp: dayjs(event.timestamp).format(timeform),
      action: "transcribe",
      ...rawprop,
      ...data,
    })
    t.emit("data", {
      confidence: 0,
      transcript: data.text,
    })
  })

  // マイクの音声認識の閾値を変更
  t.on("mic_threshold", function (threshold) {
    //
  })

  // 音声解析開始
  t.on("startRecording", function (params) {
    recorder.resume()
  })

  // 音声解析終了
  t.on("stopRecording", function () {
    recorder.pause()
  })

  return t
}

const sp = Speech()
module.exports = sp

////////////////////////////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////////////////////////////

function main() {
  sp.emit("startRecording", {})
  sp.on("data", (res) => {
    console.log(res)
  })
}

if (require.main === module) {
  main()
}
