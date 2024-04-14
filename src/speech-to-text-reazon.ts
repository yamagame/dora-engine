import { RecordingEmitter } from "./recording-emitter"
import { Mic } from "./voice/mic"
import { UDPClient } from "./voice/udp_client"
import { Log } from "~/logger"
const io = require("socket.io-client")

function Speech() {
  const speechEmitter = new RecordingEmitter()

  const host = `http://localhost:3389`
  const socket = io(host)

  const client = new UDPClient({ port: 8890, host: "localhost" })

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
  mic.start()

  // 音声区間検出
  mic.on("voice_start", () => {
    client.start()
  })
  // 無音区間検出
  mic.on("voice_stop", () => {
    client.stop()
  })
  // 音声認識開始
  mic.on("start_recording", () => {
    client.reset()
  })
  // 音声認識停止
  mic.on("stop_recording", () => {
    client.reset()
  })
  // 音声データ受信
  mic.on("data", (data) => {
    client.send(data)
  })

  // マイクの音声認識の閾値を変更
  speechEmitter.on("mic_threshold", (threshold) => {
    //
  })

  // 音声解析開始
  speechEmitter.on("startRecording", async (params) => {
    mic.startRecording()
    Log.info("#", "startRecording", mic.isRecording())
  })

  // 音声解析停止
  speechEmitter.on("stopRecording", async () => {
    mic.stopRecording()
    Log.info("#", "stopRecording")
  })

  socket.on("connect", function () {
    console.log("connected")
  })

  socket.on("utterance", function (payload) {
    if (mic.isRecording()) {
      mic.stopRecording()
      let candidate = {
        confidence: 0,
        transcript: payload.text,
      }
      speechEmitter.emit("data", candidate)
      console.log(payload)
    }
  })

  socket.on("disconnect", function () {
    console.log("disconnect")
    if (mic.isRecording()) {
      mic.stopRecording()
      let candidate = {
        confidence: 0,
        transcript: "[disconnect]",
      }
      speechEmitter.emit("data", candidate)
    }
  })

  return speechEmitter
}

export default Speech

////////////////////////////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////////////////////////////

function micRecorder() {
  const sp = Speech()

  sp.emit("startRecording", {})
  sp.on("data", (res) => {
    Log.info(res)
  })
}

function main() {
  micRecorder()
}

if (require.main === module) {
  main()
}
