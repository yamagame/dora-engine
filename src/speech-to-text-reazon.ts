import * as EventEmitter from "events"
import { config } from "./config"
import axios from "axios"

class RecordingEmitter extends EventEmitter {
  constructor() {
    super()
  }
}

function Speech() {
  const t = new RecordingEmitter()

  // マイクの音声認識の閾値を変更
  t.on("mic_threshold", function (threshold) {
    //
  })

  // 音声解析開始
  t.on("startRecording", async function (params) {
    try {
      console.log("reazon", "startRecording")
      const body = await axios({
        url: `http://${config.reazon.host}:${config.reazon.port}/listen/start`,
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
      console.log("reazon", "stopRecording")
      const body = await axios({
        url: `http://${config.reazon.host}:${config.reazon.port}/listen/stop`,
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
