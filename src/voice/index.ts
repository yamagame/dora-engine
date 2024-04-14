// import * as fs from "fs"
import { Mic } from "./mic"
import { Recorder } from "./recorder"
import { UDPClient } from "./udp_client"

async function main() {
  const readline = require("node:readline/promises")

  const client = new UDPClient({ port: 8890, host: "localhost" })
  const micInstance = new Mic({
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
  micInstance.start()

  micInstance.on("voice_start", () => {
    client.start()
  })
  micInstance.on("voice_stop", () => {
    client.stop()
  })
  micInstance.on("data", (data) => {
    client.send(data)
  })

  const { stdin: input, stdout: output } = require("node:process")
  const rl = readline.createInterface({ input, output })
  while (true) {
    if (micInstance.isRecording()) {
      await rl.question("\n")
      micInstance.stopRecording()
    } else {
      await rl.question(">")
      micInstance.startRecording()
    }
  }
}

if (require.main === module) {
  main()
}
