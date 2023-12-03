import { RecordingEmitter } from "./recording-emitter"
import { config } from "./config"
import axios from "axios"

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
      console.log("reazon", "startRecording", url)
      const body = await axios({
        url,
        method: "POST",
        data: {},
      })
      console.log(body.data.toString().trim())
    } catch (err) {
      console.error(err)
    }
  })

  // 音声解析終了
  t.on("stopRecording", async function () {
    try {
      const url = `http://${this.host}:${this.port}/listen/stop`
      console.log("reazon", "stopRecording", url)
      const body = await axios({
        url,
        method: "POST",
        data: {},
      })
      console.log(body.data.toString().trim())
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
    console.log(res)
  })
}

if (require.main === module) {
  main()
}
