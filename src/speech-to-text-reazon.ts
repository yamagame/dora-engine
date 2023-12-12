import { RecordingEmitter } from "./recording-emitter"
import { config } from "./config"
import axios from "axios"
import { Log } from "~/logger"

function Speech() {
  const t = new RecordingEmitter()

  t.host = config.reazon.host
  t.port = config.reazon.port

  // マイクの音声認識の閾値を変更
  t.on("mic_threshold", function (threshold) {
    //
  })

  // 音声解析開始
  t.on("startRecording", async function (params) {
    try {
      const url = `http://${this.host}:${this.port}/listen/start`
      Log.info("reazon", "startRecording", url)
      const body = await axios({
        url,
        method: "POST",
        data: {},
      })
      Log.info(body.data.toString().trim())
    } catch (err) {
      console.error(err)
    }
  })

  // 音声解析終了
  t.on("stopRecording", async function () {
    try {
      const url = `http://${this.host}:${this.port}/listen/stop`
      Log.info("reazon", "stopRecording", url)
      const body = await axios({
        url,
        method: "POST",
        data: {},
      })
      Log.info(body.data.toString().trim())
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
