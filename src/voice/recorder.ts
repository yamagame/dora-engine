import { EventEmitter } from "events"

export type RecorderState = "idle" | "recording" | "speaking" | "delay" | "transcribe"

export class Recorder extends EventEmitter {
  delay: number = 0
  buffers: Int16Array[] = []
  state: RecorderState = "idle"
  recording: boolean = false
  pre_recording_size = -1
  delay_recording_size = 3
  pre_load_counter: number = 0

  constructor() {
    super()
  }

  voice_start() {
    console.log(">>>>>>>>>>>>>>>>>>>>> voice_start")
    if (this.recording) {
      this.state = "recording"
      this.emit("voice_start")
    }
  }

  voice_stop() {
    console.log(">>>>>>>>>>>>>>>>>>>>> voice_stop")
    if (this.recording) {
      this.state = "delay"
      this.delay = this.delay_recording_size
    }
  }

  start_recording() {
    console.log(">>>>>>>>>>>>>>>>>>>>> start_recording")
    this.recording = true
    this.state = "idle"
    this.buffers = []
    this.pre_load_counter = 0
    this.emit("start_recording")
  }

  stop_recording() {
    console.log(">>>>>>>>>>>>>>>>>>>>> stop_recording")
    this.recording = false
    this.state = "idle"
    this.buffers = []
    this.pre_load_counter = 0
    this.emit("stop_recording")
  }

  send() {
    if (this.buffers.length <= 0) return
    this.emit("data", this.buffers)
    this.buffers = []
  }

  idle(chunk: Buffer) {
    var arrayBuffer = new Uint8Array(chunk).buffer
    const wavedata = new Int16Array(arrayBuffer)
    this.buffers.push(wavedata)
    if (this.pre_load_counter < this.pre_recording_size * -2) {
      this.buffers = []
      this.pre_load_counter++
    } else {
      this.buffers = this.buffers.slice(-100)
    }
    if (!this.recording) {
      this.state = "idle"
      return
    }
    if (this.delay > 0 && this.state !== "idle") {
      this.send()
      this.delay--
      if (this.delay === 0) {
        this.emit("voice_stop")
        if (this.state === "delay") {
          this.state = "idle"
        }
        this.buffers = [] //this.buffers.slice(this.pre_recording_size)
      }
    } else if (this.state === "idle") {
      this.buffers = this.buffers.slice(this.pre_recording_size)
    } else {
      this.send()
    }
  }
}
