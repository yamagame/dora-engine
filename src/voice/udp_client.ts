const dgram = require("dgram")
import { WaveUnit, WaveUnit_Action } from "./proto/wave"

const default_options = { port: 8890, host: "localhost" }
const UDP_MTU = 500

export class UDPConfig {
  host?: string
  port?: number
}

export class UDPClient {
  config: UDPConfig = default_options
  socket = dgram.createSocket("udp4")
  sendTimer: NodeJS.Timeout = null
  sendBuffer: Uint8Array[] = []
  counter: number = 0

  constructor(config?: UDPConfig) {
    this.config = { ...this.config, ...config }
  }

  send(buffers: Int16Array[]) {
    for (const data of buffers) {
      for (var i = 0; i < data.length; i += UDP_MTU) {
        const remain = data.length - i
        const d = data.slice(i, remain < UDP_MTU ? remain : i + UDP_MTU)
        if (d.length != 0) {
          const wave = new Int16Array(d.length)
          wave.set(d, 0)
          const packet = WaveUnit.encode({
            id: this.counter++,
            action: WaveUnit_Action.ACTION_BODY,
            wave: new Uint8Array(wave.buffer),
          }).finish()
          this.sendBuffer.push(packet)
        }
      }
    }
    this.socket_idle()
  }

  start() {
    this.socket_idle()
  }

  stop() {
    const packet = WaveUnit.encode({
      id: this.counter++,
      action: WaveUnit_Action.ACTION_CLOSE,
      wave: new Uint8Array([]),
    }).finish()
    this.sendBuffer.push(packet)
    this.socket_idle()
  }

  reset() {
    const packet = WaveUnit.encode({
      id: this.counter++,
      action: WaveUnit_Action.ACTION_RESET,
      wave: new Uint8Array([]),
    }).finish()
    this.sendBuffer.push(packet)
    this.socket_idle()
  }

  socket_idle() {
    if (this.sendTimer) return
    this.sendTimer = setInterval(() => {
      if (this.sendBuffer.length <= 0) {
        clearInterval(this.sendTimer)
        this.sendTimer = null
        return
      }
      const bytes = this.sendBuffer.shift()
      this.socket.send(bytes, 0, bytes.length, this.config.port, this.config.host, (err, bytes) => {
        if (err) throw err
      })
    }, 1)
  }
}
