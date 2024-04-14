// https://github.com/ashishbajaj99/mic
// 上記記事のソースを参考にしています。

import { Stream, Writable } from "stream"
import { spawn, SpawnOptions } from "child_process"
import * as os from "os"
import { VADStream, VAD, VADProps } from "./vad"
import { EventEmitter } from "events"

const isMac = os.type() == "Darwin"
const isWindows = os.type().indexOf("Windows") > -1

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
  audioStream?: Writable = null
}

export class Mic extends EventEmitter {
  options: {
    endian: "little" | "big"
    bitwidth: string
    encoding: string
    rate: string
    channels: string
    device: string
    exitOnSilence: number
    fileType: string
    audioStream: Writable
  } = {
    endian: "little",
    bitwidth: "16",
    encoding: "signed-integer",
    rate: "16000",
    channels: "1",
    device: "plughw:1,0",
    exitOnSilence: 6,
    fileType: "raw",
    audioStream: null,
  }
  debug: boolean
  format = ""
  formatEndian = "BE"
  formatEncoding = "U"
  audioProcess = null
  vadStream: Stream
  audioStream: Writable | null
  audioProcessOptions: SpawnOptions = {
    stdio: ["ignore", "pipe", "ignore"],
  }
  vad: VAD

  constructor(options: MicOptions) {
    super()
    const energyThresholdRatioPos = 1
    const energyThresholdRatioNeg = 0.5
    const vadOptions = new VADProps()
    vadOptions.energy_threshold_ratio_pos = energyThresholdRatioPos
    vadOptions.energy_threshold_ratio_neg = energyThresholdRatioNeg
    vadOptions.sampleRate = parseInt(options.rate)
    const vad = new VAD(vadOptions)
    vad.on("ready", () => {
      this.emit("ready")
    })
    vad.recorder.on("voice_start", () => {
      this.emit("voice_start")
    })
    vad.recorder.on("voice_stop", () => {
      this.emit("voice_stop")
    })
    vad.recorder.on("start_recording", () => {
      this.emit("start_recording")
    })
    vad.recorder.on("stop_recording", () => {
      this.emit("stop_recording")
    })
    vad.recorder.on("data", (data) => {
      this.emit("data", data)
    })

    this.options = { ...this.options, ...options }
    this.debug = options.debug || this.debug

    this.vadStream = VADStream(vad)
    this.audioStream = this.options.audioStream

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

    this.vad = vad
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

      if (this.audioStream != null) {
        this.vadStream.pipe(this.audioStream)
      } else {
        this.vadStream.on("data", (data) => {
          // なにもしない
        })
      }

      this.audioProcess.on("exit", (code, sig) => {
        if (code != null && sig === null) {
          if (debug) console.log("recording audioProcess has exited with code = %d", code)
        }
      })
      this.audioProcess.stdout.pipe(this.vadStream)
    } else {
      if (debug) {
        throw new Error("Duplicate calls to start(): Microphone already started!")
      }
    }
  }

  stop() {
    if (this.audioProcess != null) {
      this.audioProcess.kill("SIGTERM")
      this.audioProcess = null
    }
  }

  pause() {
    if (this.audioProcess != null) {
      this.audioProcess.kill("SIGSTOP")
    }
  }

  resume() {
    if (this.audioProcess != null) {
      this.audioProcess.kill("SIGCONT")
    }
  }

  isRecording() {
    return this.vad.isRecording()
  }

  startRecording() {
    this.vad.startRecording()
  }

  stopRecording() {
    this.vad.stopRecording()
  }
}
