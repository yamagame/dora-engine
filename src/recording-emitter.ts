import { EventEmitter } from "events"
import { Socket } from "socket.io"

export class RecordingEmitter extends EventEmitter {
  _masters: { [index: string]: Socket } = null
  _host: string = null
  _port: string = null

  constructor() {
    super()
  }

  set masters(masters) {
    this._masters = masters
  }

  get masters() {
    return this._masters
  }

  set host(host) {
    this._host = host
  }

  get host() {
    return this._host
  }

  set port(port) {
    this._port = port
  }

  get port() {
    return this._port
  }
}
