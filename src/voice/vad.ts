import { EventEmitter } from "events"
import { Transform, TransformCallback, TransformOptions } from "stream"
import { DFT } from "./dtf"
import { Recorder } from "./recorder"

const color = (col) => (str) => `\u001b[${col}m${str}\u001b[0m` // 補助関数
const colors = {
  black: color("30"),
  red: color("31"),
  green: color("32"),
  yellow: color("33"),
  blue: color("34"),
  magenta: color("35"),
  cyan: color("36"),
  white: color("37"),
}

export function MinMax(label) {
  this.min = 0
  this.max = 0
  this.first = true
  this.reset = () => {
    this.min = 0
    this.max = 0
    this.first = true
  }
  this.set = (v) => {
    if (this.first) {
      this.min = v
      this.max = v
      this.first = false
    } else {
      if (this.min > v) this.min = v
      if (this.max < v) this.max = v
    }
  }
  this.print = () => {
    console.log(label, "min", this.min, "max", this.max)
  }
}

export const VADStream = (vad: VAD, options: TransformOptions = {}) => {
  const sampleData = []
  const minmax1 = new MinMax("sample")
  const minmax2 = new MinMax("fft")
  return new Transform({
    transform(chunk: Buffer, encoding: string, done: TransformCallback): void {
      const buffer = new Int16Array(chunk.length / 2)

      let speechSample = 0
      let n = 0
      minmax1.reset()

      var arrayBuffer = new Uint8Array(chunk).buffer
      const wavedata = new Int16Array(arrayBuffer)

      for (let i = 0; i < wavedata.length; i++) {
        speechSample = wavedata[i]
        buffer[i] = speechSample
        sampleData[n] = speechSample / 0x7fff
        minmax1.set(sampleData[n])
        n++
        if (n >= vad.floatFrequencyData.length * 2) {
          DFT.fftHighSpeed(vad.floatFrequencyData.length, sampleData)
          minmax2.reset()
          for (let i = 0; i < sampleData.length; i += 2) {
            const o = sampleData[i]
            const q = sampleData[i + 1]
            const v = Math.sqrt(o * o + q * q)
            minmax2.set(v)
            vad.floatFrequencyData[i / 2] = v / 1000
          }
          vad.update()
          vad.monitor()
          n = 0
        }
      }

      vad.idle(chunk)
      if (vad.state == "start") {
        this.push(chunk)
      }
      done()
    },
    ...options,
  })
}

class Filter {
  f: number = 0
  v: number = 0
}

const DEBUG = false

export class VADProps {
  smoothingTimeConstant: number = 0.99
  fftSize: number = 512
  frequencyBinCount: number = 256
  energy_threshold_ratio_pos: number = 2
  energy_threshold_ratio_neg: number = 0.5
  sampleRate: number = 48000
}

class VADOptions {
  fftSize: number
  bufferLen: number
  smoothingTimeConstant: number
  energy_offset: number // The initial offset.
  energy_threshold_ratio_pos: number // Signal must be twice the offset
  energy_threshold_ratio_neg: number // Signal must be half the offset
  energy_integration: number // Size of integration change compared to the signal per second.
  shape: Filter[]
  sampleRate: number = 48000
  frequencyBinCount: number = 256
  constructor() {
    this.fftSize = 512
    this.bufferLen = 512
    this.smoothingTimeConstant = 0.99
    this.energy_offset = 1e-7 // The initial offset.
    this.energy_threshold_ratio_pos = 2 // Signal must be twice the offset
    this.energy_threshold_ratio_neg = 0.5 // Signal must be half the offset
    this.energy_integration = 1 // Size of integration change compared to the signal per second.
    this.shape = [
      { f: 200, v: 0 }, // 0 -> 200 is 0
      { f: 2000, v: 1 }, // 200 -> 2k is 1
    ]
  }
}

export class VAD extends EventEmitter {
  options: VADOptions
  filter: number[]
  hertzPerBin: number
  iterationFrequency: number
  iterationPeriod: number
  ready: { energy?: boolean }
  vadState: boolean
  energy_offset: number
  energy_threshold_pos: number
  energy_threshold_neg: number
  voiceTrend: number
  voiceTrendMax: number
  voiceTrendMin: number
  voiceTrendStart: number
  voiceTrendEnd: number
  floatFrequencyData: Float32Array
  floatFrequencyDataLinear: Float64Array
  logging: boolean
  log_i: number
  log_limit: number
  energy: number = 0
  state: string = "idle"
  energyavg: number = 0
  energycount: number = 0
  recorder: Recorder = null

  constructor(options: VADProps) {
    super()
    this.recorder = new Recorder()
    this.options = new VADOptions()
    this.options = {
      ...this.options,
      ...options,
    }

    // Calculate time relationships
    this.hertzPerBin = this.options.sampleRate / this.options.fftSize
    this.iterationFrequency = this.options.sampleRate / this.options.bufferLen
    this.iterationPeriod = 1 / this.iterationFrequency

    if (DEBUG) {
      console.log(
        "Vad" +
          " | sampleRate: " +
          this.options.sampleRate +
          " | hertzPerBin: " +
          this.hertzPerBin +
          " | iterationFrequency: " +
          this.iterationFrequency +
          " | iterationPeriod: " +
          this.iterationPeriod
      )
    }

    const setFilter = (shape: Filter[]) => {
      for (let i = 0, iLen = this.options.fftSize / 2; i < iLen; i++) {
        this.filter[i] = 0
        for (let j = 0, jLen = shape.length; j < jLen; j++) {
          if (i * this.hertzPerBin < shape[j].f) {
            this.filter[i] = shape[j].v
            break // Exit j loop
          }
        }
      }
    }

    this.filter = []
    setFilter(this.options.shape)
    if (DEBUG) {
      console.log(this.options.shape)
      console.log(this.filter)
    }

    this.ready = {}
    this.vadState = false // True when Voice Activity Detected

    // Energy detector props
    this.energy_offset = this.options.energy_offset
    this.energy_threshold_pos = this.energy_offset * this.options.energy_threshold_ratio_pos
    this.energy_threshold_neg = this.energy_offset * this.options.energy_threshold_ratio_neg

    this.voiceTrendMax = 10
    this.voiceTrendMin = -10
    this.voiceTrendStart = 5
    this.voiceTrendEnd = -5
    this.voiceTrend = this.voiceTrendMin

    // Setup local storage of the Linear FFT data
    this.floatFrequencyData = new Float32Array(this.options.frequencyBinCount)
    this.floatFrequencyDataLinear = new Float64Array(this.floatFrequencyData.length)

    // log stuff
    this.logging = false
    this.log_i = 0
    this.log_limit = 100

    this.recorder.recording = false
    this.recorder.state = "idle"
    this.recorder.delay = 0
  }

  triggerLog(limit: number) {
    this.logging = true
    this.log_i = 0
    this.log_limit = typeof limit === "number" ? limit : this.log_limit
  }

  log(msg: string) {
    if (this.logging && this.log_i < this.log_limit) {
      this.log_i++
      console.log(msg)
    } else {
      this.logging = false
    }
  }

  update() {
    // 声の周波数帯は 100～1000Hz
    // Update the local version of the Linear FFT
    const fft = this.floatFrequencyData
    for (let i = 0, iLen = fft.length; i < iLen; i++) {
      this.floatFrequencyDataLinear[i] = fft[i]
      // this.floatFrequencyDataLinear[i] = Math.pow(10, fft[i] / 10)
    }
    this.ready = {}
  }

  getEnergy() {
    if (this.ready.energy) {
      return this.energy
    }

    let energy = 0
    const fft = this.floatFrequencyDataLinear

    for (let i = 0, iLen = fft.length; i < iLen; i++) {
      energy += this.filter[i] * fft[i] * fft[i]
    }

    this.energy = energy
    this.ready.energy = true

    return energy
  }

  monitor() {
    const energy = this.getEnergy()
    const signal = energy - this.energy_offset

    this.energyavg = (this.energyavg * this.energycount + energy) / (this.energycount + 1)

    const numlen = (val) => (((val * 1e9) | 0) + "").length
    const signallenth = numlen(energy) - numlen(this.energy_offset)
    const plus = signallenth <= 1 ? 1 : (signallenth - 1) * 2
    const minus = 1

    if (signal > this.energy_threshold_pos) {
      this.voiceTrend =
        this.voiceTrend + plus > this.voiceTrendMax ? this.voiceTrendMax : this.voiceTrend + plus
    } else if (signal < -this.energy_threshold_neg) {
      this.voiceTrend =
        this.voiceTrend - minus < this.voiceTrendMin ? this.voiceTrendMin : this.voiceTrend - minus
    } else {
      // voiceTrend gets smaller
      if (this.voiceTrend > 0) {
        this.voiceTrend--
      } else if (this.voiceTrend < 0) {
        this.voiceTrend++
      }
    }

    let start = false
    let end = false
    if (this.voiceTrend > this.voiceTrendStart) {
      // Start of speech detected
      start = true
    } else if (this.voiceTrend < this.voiceTrendEnd) {
      // End of speech detected
      end = true
    }

    // Integration brings in the real-time aspect through the relationship with the frequency this functions is called.
    const integration = signal * this.iterationPeriod * this.options.energy_integration

    // Idea?: The integration is affected by the voiceTrend magnitude? - Not sure. Not doing atm.

    // The !end limits the offset delta boost till after the end is detected.
    if (integration > 0 || !end) {
      this.energy_offset += integration
    } else {
      this.energy_offset += integration * 10
    }

    this.energy_offset = this.energy_offset < 0 ? 0 : this.energy_offset
    this.energy_threshold_pos = this.energy_offset * this.options.energy_threshold_ratio_pos
    this.energy_threshold_neg = this.energy_offset * this.options.energy_threshold_ratio_neg

    if (DEBUG && this.recorder.recording) {
      const log = () => {
        const numstr = (val) => ("        " + ((val * 1e9) | 0)).slice(-8)
        const intstr = (val, n = 4) => ("        " + val).slice(-n)
        console.clear()
        console.log(
          `energy`,
          numstr(energy),
          `len`,
          intstr(signallenth),
          `signal`,
          numstr(signal),
          `trend`,
          intstr(this.voiceTrend),
          "pos",
          numstr(this.energy_threshold_pos),
          "neg",
          numstr(this.energy_threshold_neg),
          "off",
          numstr(this.energy_offset),
          "state",
          this.vadState || this.recorder.delay > 0 ? `${colors.red("1")}` : "0",
          "start",
          start ? "1" : "0",
          "end",
          end ? "1" : "0",
          "count",
          this.energycount
        )
      }
      log()
    }

    if (this.energycount < 100) {
      this.energycount++
      if (this.energycount == 100) {
        this.emit("ready")
        this.voiceTrend = this.voiceTrendMin
      }
      return
    }

    // Broadcast the messages
    if (start && !this.vadState) {
      this.vadState = true
      this.state = "start"
      this.recorder.voice_start()
    }
    if (end && this.vadState) {
      this.vadState = false
      this.state = "stop"
      this.recorder.voice_stop()
    }

    return signal
  }

  idle(chunk: Buffer) {
    this.recorder.idle(chunk)
  }

  isRecording() {
    return this.recorder.recording
  }

  startRecording() {
    this.recorder.start_recording()
    this.voiceTrend = this.voiceTrendMin
    this.state = "idle"
    this.vadState = false
  }

  stopRecording() {
    this.recorder.stop_recording()
    this.vadState = false
  }
}
