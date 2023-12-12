import { RecordingEmitter } from "./recording-emitter"
import { Log } from "~/logger"

function Speech() {
  const t = new RecordingEmitter()

  // マイクの音声認識の閾値を変更
  t.on("mic_threshold", function (threshold) {
    //
  })

  // 音声解析開始
  t.on("startRecording", async function (params) {
    try {
      Object.keys(this.masters).some((client_id) => {
        this.masters[client_id].emit("startRecording")
        return true
      })
    } catch (err) {
      console.error(err)
    }
  })

  // 音声解析終了
  t.on("stopRecording", async function () {
    try {
      Object.keys(this.masters).some((client_id) => {
        this.masters[client_id].emit("stopRecording")
        return true
      })
    } catch (err) {
      console.error(err)
    }
  })

  return t
}

export default Speech

////////////////////////////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////////////////////////////

function main() {
  const sp = Speech()

  sp.emit("startRecording", {})
  sp.on("data", (res) => {
    Log.info(res)
  })
}

if (require.main === module) {
  main()
}
