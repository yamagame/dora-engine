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
  const conf = {
    HOST: config.reazon.host,
    PORT: config.reazon.port,
  }

  // マイクの音声認識の閾値を変更
  t.on("mic_threshold", function (threshold) {
    //
  })

  // 音声解析開始
  t.on("startRecording", async function (params) {
    try {
      const url = `http://${conf.HOST}:${conf.PORT}/listen/start`
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
      const url = `http://${conf.HOST}:${conf.PORT}/listen/stop`
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

  t.on("host", function (host) {
    console.log("reazon: host", host)
    conf.HOST = host
  })

  t.on("port", function (port) {
    console.log("reazon: port", port)
    conf.PORT = port
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
