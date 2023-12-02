import * as EventEmitter from "events"
import { Socket } from "socket.io"

type chatControllerCallback = (payload?: any) => void

export class ChatController extends EventEmitter {
  _chatServers: { [index: string]: { socket: Socket } } = {}
  constructor() {
    super()
  }

  add(socket: Socket) {
    const chatServer = {
      socket,
    }
    this._chatServers[socket.id] = chatServer
    console.log("chat server", socket.id)
  }

  remove(socket: Socket) {
    delete this._chatServers[socket.id]
  }

  call(message, payload, callback: chatControllerCallback = null) {
    if (
      !Object.keys(this._chatServers).some((key) => {
        try {
          const chatServer = this._chatServers[key]
          chatServer.socket.emit(message, payload, (payload) => {
            if (callback) callback(payload)
          })
        } catch (err) {
          console.error(err)
        }
        return true
      })
    ) {
      if (callback) callback({ text: "end" })
    }
  }

  stop(callback: chatControllerCallback = null) {
    this.call("reset", {}, callback)
  }

  ask(payload, callback: chatControllerCallback = null) {
    this.call("ask", { text: payload.text }, callback)
  }

  get(callback: chatControllerCallback = null) {
    this.call("get", {}, (payload) => {
      console.log(payload)
      if (callback) callback(payload)
    })
  }
}
