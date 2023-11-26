import { spawn, SpawnOptions } from "child_process"
import * as os from "os"
import * as stream from "stream"
import { IsSilence } from "./silenceTransform"

const isMac = os.type() == "Darwin"
const isWindows = os.type().indexOf("Windows") > -1
const { PassThrough } = stream

class MicOptions {
  endian?: "little" | "big"
  bitwidth?: string
  encoding?: string
  rate?: string
  channels?: string
  device?: string
  exitOnSilence?: number
  fileType?: string
  debug?: boolean = false
}

export class Mic {
  options: {
    endian: "little" | "big"
    bitwidth: string
    encoding: string
    rate: string
    channels: string
    device: string
    exitOnSilence: number
    fileType: string
  } = {
    endian: "little",
    bitwidth: "16",
    encoding: "signed-integer",
    rate: "16000",
    channels: "1",
    device: "plughw:1,0",
    exitOnSilence: 6,
    fileType: "raw",
  }
  debug: boolean
  format = ""
  formatEndian = "BE"
  formatEncoding = "U"
  audioProcess = null
  infoStream = new PassThrough()
  audioStream: any
  audioProcessOptions: SpawnOptions = {
    stdio: ["ignore", "pipe", "ignore"],
  }

  constructor(options: MicOptions) {
    this.audioStream = new IsSilence({ debug: options.debug })
    this.options = { ...this.options, ...options }
    this.debug = options.debug || this.debug

    if (this.debug) {
      this.audioProcessOptions.stdio = ["ignore", "pipe", "pipe"]
    }

    // Setup format variable for arecord call
    if (this.options.endian === "big") {
      this.formatEndian = "BE"
    } else {
      this.formatEndian = "LE"
    }
    if (this.options.encoding === "unsigned-integer") {
      this.formatEncoding = "U"
    } else {
      this.formatEncoding = "S"
    }
    this.format = this.formatEncoding + this.options.bitwidth + "_" + this.formatEndian
    this.audioStream.setNumSilenceFramesExitThresh(this.options.exitOnSilence)

    if (this.debug) {
      this.infoStream.on("data", function (data) {
        console.log("Received Info: " + data)
      })
      this.infoStream.on("error", function (error) {
        console.log("Error in Info Stream: " + error)
      })
    }
  }

  start() {
    const { bitwidth, endian, channels, rate, encoding, fileType, device } = this.options
    const debug = this.debug
    const format = this.format
    if (this.audioProcess === null) {
      if (isWindows) {
        this.audioProcess = spawn(
          "sox",
          [
            "-b",
            bitwidth,
            "--endian",
            endian,
            "-c",
            channels,
            "-r",
            rate,
            "-e",
            encoding,
            "-t",
            "waveaudio",
            "default",
            "-p",
          ],
          this.audioProcessOptions
        )
      } else if (isMac) {
        this.audioProcess = spawn(
          "rec",
          [
            "-b",
            bitwidth,
            "--endian",
            endian,
            "-c",
            channels,
            "-r",
            rate,
            "-e",
            encoding,
            "-t",
            fileType,
            "-",
          ],
          this.audioProcessOptions
        )
      } else {
        this.audioProcess = spawn(
          "arecord",
          ["-t", fileType, "-c", channels, "-r", rate, "-f", format, "-D", device],
          this.audioProcessOptions
        )
      }

      this.audioProcess.on("exit", (code, sig) => {
        if (code != null && sig === null) {
          this.audioStream.emit("audioProcessExitComplete")
          if (debug) console.log("recording audioProcess has exited with code = %d", code)
        }
      })
      this.audioProcess.stdout.pipe(this.audioStream)
      if (debug) {
        this.audioProcess.stderr.pipe(this.infoStream)
      }
      this.audioStream.emit("startComplete")
    } else {
      if (debug) {
        throw new Error("Duplicate calls to start(): Microphone already started!")
      }
    }
  }

  stop() {
    const debug = this.debug
    if (this.audioProcess != null) {
      this.audioProcess.kill("SIGTERM")
      this.audioProcess = null
      this.audioStream.emit("stopComplete")
      if (debug) console.log("Microphone stopped")
    }
  }

  pause() {
    const debug = this.debug
    if (this.audioProcess != null) {
      this.audioProcess.kill("SIGSTOP")
      this.audioStream.pause()
      this.audioStream.emit("pauseComplete")
      if (debug) console.log("Microphone paused")
    }
  }

  resume() {
    const debug = this.debug
    if (this.audioProcess != null) {
      this.audioProcess.kill("SIGCONT")
      this.audioStream.resume()
      this.audioStream.emit("resumeComplete")
      if (debug) console.log("Microphone resumed")
    }
  }

  getAudioStream() {
    return this.audioStream
  }
}
