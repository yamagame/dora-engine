import { config } from "./config"
import axios from "axios"
import { RecordingEmitter } from "./recording-emitter"

function Speech() {
  const t = new RecordingEmitter()

  // マイクの音声認識の閾値を変更
  t.on("mic_threshold", function (threshold) {
    //
  })

  // 音声解析開始
  t.on("startRecording", async function (params) {
    try {
      Object.keys(this.masters).forEach((client_id) => {
        this.masters[client_id].emit("startRecording")
      })
    } catch (err) {
      console.error(err)
    }
  })

  // 音声解析終了
  t.on("stopRecording", async function () {
    try {
      Object.keys(this.masters).forEach((client_id) => {
        this.masters[client_id].emit("stopRecording")
      })
    } catch (err) {
      console.error(err)
    }
  })

  return t
}

export default Speech()

////////////////////////////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////////////////////////////

function main() {
  const sp = Speech()

  sp.emit("startRecording", {})
  sp.on("data", (res) => {
    console.log(res)
  })
}

if (require.main === module) {
  main()
}
