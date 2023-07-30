import Mic from "../index"
import * as fs from "fs"

function main() {
  const micInstance = new Mic({
    rate: "48000",
    channels: "1",
    debug: false,
    exitOnSilence: 6,
    fileType: "wav",
  })
  const micInputStream = micInstance.getAudioStream()

  const outputFileStream = fs.createWriteStream("./work/output.wav")

  micInputStream.pipe(outputFileStream)

  let chunkCounter = 0
  micInputStream.on("data", function (data) {
    console.log("Recieved Input Stream of Size %d: %d", data.length, chunkCounter++)
  })

  micInputStream.on("error", function (err) {
    console.log("Error in Input Stream: " + err)
  })

  micInputStream.on("startComplete", function () {
    console.log("Got SIGNAL startComplete")
    setTimeout(function () {
      micInstance.pause()
    }, 5000)
  })

  micInputStream.on("stopComplete", function () {
    console.log("Got SIGNAL stopComplete")
  })

  micInputStream.on("pauseComplete", function () {
    console.log("Got SIGNAL pauseComplete")
    setTimeout(function () {
      micInstance.resume()
    }, 5000)
  })

  micInputStream.on("resumeComplete", function () {
    console.log("Got SIGNAL resumeComplete")
    setTimeout(function () {
      micInstance.stop()
    }, 5000)
  })

  micInputStream.on("silence", function () {
    console.log("Got SIGNAL silence")
  })

  micInputStream.on("processExitComplete", function () {
    console.log("Got SIGNAL processExitComplete")
  })

  micInstance.start()
}

if (require.main === module) {
  main()
}
