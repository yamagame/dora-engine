import { EventEmitter } from "events"
import Mic from "../mic"
import Vad from "../vad"
import DFT from "../dtf"
import { MinMax } from "../utils"

type RecorderState = "idle" | "recording" | "speaking" | "delay" | "transcribe"

export class Recorder extends EventEmitter {
  private _micInputStream: any
  delay: number = 0
  buffers: Int16Array[] = []
  state: RecorderState = "idle"
  _recording: boolean = false

  constructor(
    { energyThresholdRatioPos, energyThresholdRatioNeg, sampleRate } = {
      energyThresholdRatioPos: 2,
      energyThresholdRatioNeg: 0.5,
      sampleRate: 48000,
    }
  ) {
    super()

    // VAD のオプション設定 (詳細後述)
    const VadOptions = new Vad.VADProps()
    // 音声区間検出終了時ハンドラ
    VadOptions.voice_stop = () => {
      if (this._recording) {
        this.emit("voice_stop")
        this.state = "delay"
        this.delay = 15
      }
    }
    // 音声区間検出開始時ハンドラ
    VadOptions.voice_start = () => {
      if (this._recording) {
        this.state = "recording"
        this.emit("voice_start")
      }
    }
    VadOptions.energy_threshold_ratio_pos = energyThresholdRatioPos
    VadOptions.energy_threshold_ratio_neg = energyThresholdRatioNeg
    VadOptions.sampleRate = sampleRate

    const vad = new Vad.VAD(VadOptions)
    const micInstance = new Mic({
      rate: `${sampleRate}`,
      channels: "1",
      debug: true,
      exitOnSilence: 0,
      encoding: "signed-integer",
      fileType: "raw",
      endian: "little",
      device: "plug:micboost",
    })

    const toShort = (high, low) => {
      let speechSample = 0
      const sign = (byte) => {
        if (byte > 128) {
          return (byte - 256) * 256
        }
        return byte * 256
      }
      speechSample = sign(high)
      speechSample += low
      return speechSample
    }

    const micInputStream = micInstance.getAudioStream()

    // let chunkCounter = 0
    const sampleData = []
    let n = 0
    const minmax1 = new MinMax("sample")
    const minmax2 = new MinMax("fft")
    micInputStream.on("data", (data) => {
      const buffer = new Int16Array(data.length / 2)
      // console.log("Recieved Input Stream of Size %d: %d", data.length, chunkCounter++)
      minmax1.reset()
      for (let i = 0; i < data.length; i += 2) {
        const speechSample = toShort(data[i + 1], data[i])
        buffer[i / 2] = speechSample
        sampleData[n] = speechSample / 0x7fff
        minmax1.set(sampleData[n])
        n++
        if (n >= vad.floatFrequencyData.length * 2) {
          // console.log(sampleData.length)
          DFT.fftHighSpeed(vad.floatFrequencyData.length, sampleData)
          minmax2.reset()
          for (let i = 0; i < sampleData.length; i += 2) {
            const o = sampleData[i]
            const q = sampleData[i + 1]
            const v = Math.sqrt(o * o + q * q)
            minmax2.set(v)
            vad.floatFrequencyData[i / 2] = v / 1000
          }
          // minmax2.print()
          vad.update()
          vad.monitor()
          n = 0
        }
      }
      this.buffers.push(buffer)
      if (this.delay > 0 && this.state !== "idle") {
        this.delay--
        if (this.delay === 0) {
          this.transcribe()
          if (this.state === "delay") {
            this.state = "idle"
          }
          this.buffers = this.buffers.slice(-3)
        }
      } else if (this.state === "idle") {
        this.buffers = this.buffers.slice(-3)
      }
      this.emit("data", { data: buffer, raw: data })
      // minmax1.print()
    })

    micInputStream.on("error", function (err) {
      console.log("Error in Input Stream: " + err)
    })

    micInputStream.on("startComplete", () => {
      console.log("Got SIGNAL startComplete")
    })

    micInputStream.on("stopComplete", () => {
      console.log("Got SIGNAL stopComplete")
    })

    micInputStream.on("pauseComplete", () => {
      console.log("Got SIGNAL pauseComplete")
    })

    micInputStream.on("resumeComplete", () => {
      console.log("Got SIGNAL resumeComplete")
    })

    micInputStream.on("silence", () => {
      console.log("Got SIGNAL silence")
    })

    micInputStream.on("processExitComplete", () => {
      console.log("Got SIGNAL processExitComplete")
    })

    micInstance.start()

    this._micInputStream = micInputStream
  }

  get micInputStream() {
    return this._micInputStream
  }

  pause() {
    this._recording = false
    this.state = "idle"
    this.delay = 0
  }

  resume() {
    this._recording = true
    this.state = "idle"
    this.delay = 0
  }

  set recording(state: boolean) {
    this._recording = state
    if (state) {
      this.resume()
    } else {
      this.pause()
    }
  }

  get recording() {
    return this._recording
  }

  isRecording() {
    return this._recording
  }

  transcribe() {
    if (this.buffers.length <= 0) return
    const sampleCount = this.buffers.reduce((memo: number, buffer: Int16Array) => {
      return memo + buffer.length
    }, 0)
    const dataView = new Int16Array(sampleCount)
    let n = 0
    for (const buffer of this.buffers) {
      for (const value of buffer) {
        dataView[n] = value
        n++
      }
    }
    this.emit("transcribe", { timestamp: Date(), action: "transcribe", data: dataView })
  }
}
