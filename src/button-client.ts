import * as EventEmitter from "events"
const io = require("socket.io-client")
const ping = require("ping")
const { createSignature } = require("./accessCheck")

const clients = []

function ipResolver(client, callback) {
  function _resolve() {
    if (client.state !== "open") return
    ping.promise.probe(client.host).then(function (res) {
      if (res.alive) {
        callback(res)
      } else {
        setTimeout(() => {
          _resolve()
        }, 1000)
      }
    })
  }
  _resolve()
}

let buttons = {}
let bright = 1
let led_mode = "blink"
let led_name = ""
let blinkSpeed = 0.025
let theta = 0

function sendCommand() {
  if (led_mode == "on") {
    Object.keys(buttons).forEach((key) => {
      const button = buttons[key]
      if (button.socket && !button.localhost) {
        button.socket.emit("led-command", { action: "on", value: bright })
      }
    })
  } else if (led_mode == "off") {
    Object.keys(buttons).forEach((key) => {
      const button = buttons[key]
      if (buttons[key].socket && !button.localhost) {
        buttons[key].socket.emit("led-command", {
          action: "off",
          value: bright,
        })
      }
    })
  } else if (led_mode == "blink") {
    bright = (Math.sin(theta) + 1) / 2
    theta += blinkSpeed * 10
    if (theta >= Math.PI * 2) {
      theta -= Math.PI * 2
    }
    Object.keys(buttons).forEach((key) => {
      const button = buttons[key]
      if (button.socket && !button.localhost) {
        button.socket.emit("led-command", { action: "on", value: bright })
      }
    })
  } else if (led_mode == "one") {
    Object.keys(buttons).forEach((key) => {
      const button = buttons[key]
      if (button.socket && !button.localhost) {
        if (button.name == led_name) {
          button.socket.emit("led-command", { action: "on", value: bright })
        } else {
          button.socket.emit("led-command", { action: "off", value: bright })
        }
      }
    })
  }
}

function ButtonSocket(client, config, manager) {
  var t = {
    host: client.host,
    name: "name" in client && client.name !== null ? client.name : client.host,
    port: "port" in client && client.port !== null ? client.port : config.port,
    team: "team" in client && client.team !== null ? client.team : client.host,
    state: "open",
    socket_id: null,
  }

  const connect = (client) => {
    ipResolver(client, (res) => {
      if (client.state !== "open") return
      console.log(`found button ${client.host} ${res.numeric_host}`)
      const host = `http://${res.numeric_host}:${t.port}`
      const socket = io(host)
      t.socket_id = socket.id
      socket.on("connect", function () {
        createSignature(config.robotSecretKey, (signature) => {
          socket.emit("start-slave", { signature })
          console.log("connect", socket.id, host)
          t.socket_id = socket.id
          buttons[socket.id] = {
            socket,
            name: client.name,
          }
          sendCommand()
        })
      })
      socket.on("button", function (data) {
        manager.emit("button", { ...client })
      })
      socket.on("speech", function (payload) {
        manager.emit("speech", { ...client, speech: payload.speech })
      })
      socket.on("disconnect", function () {
        console.log("disconnect", t.socket_id)
        delete buttons[t.socket_id]
        socket.close()
        connect(client)
      })
    })
  }
  connect(t)

  return t
}

class ButtonClientEmitter extends EventEmitter {
  doCommand?: (payload: any) => void
  socket?: (name: string) => void
  constructor() {
    super()
  }
}

function ButtonClient(config: { port: number; robotSecretKey: string }) {
  let clientSocket: {
    [index: string]: {
      name: string
      host: string
      state: string
      socket_id: any
    }
  } = {}

  var t = new ButtonClientEmitter()

  t.on("open-slave", (payload) => {
    if ("host" in payload) {
      if (!clientSocket[payload.host]) {
        clientSocket[payload.host] = ButtonSocket(payload, config, t)
      }
    }
  })

  t.on("close-slave", (payload) => {
    if ("host" in payload) {
      const c = []
      Object.keys(clientSocket).forEach((key) => {
        const client = clientSocket[key]
        if (client.host === payload.host) {
          client.state = "close"
          if (client.socket_id && buttons[client.socket_id]) {
            buttons[client.socket_id].socket.close()
          }
        } else {
          c.push(client)
        }
      })
      clientSocket = {}
      c.forEach((c) => {
        clientSocket[c.host] = c
      })
    }
  })

  t.on("close-all", () => {
    Object.keys(clientSocket).forEach((key) => {
      const client = clientSocket[key]
      client.state = "close"
      if (client.socket_id && buttons[client.socket_id]) {
        buttons[client.socket_id].socket.close()
      }
    })
    clientSocket = {}
  })

  //全ボタン待機
  t.on("all-blink", (paylaod) => {
    led_mode = "blink"
  })

  //全ボタンオン
  t.on("all-on", (payload) => {
    led_mode = "on"
    bright = typeof payload.bright ? payload.bright : bright
  })

  //全ボタンオフ
  t.on("all-off", (payload) => {
    led_mode = "off"
  })

  //一つだけオン
  t.on("one", (payload) => {
    led_mode = "one"
    led_name = payload.name
    bright = typeof payload.bright ? payload.bright : bright
  })

  //明るさ
  t.on("bright", (payload) => {
    bright = typeof payload.bright ? payload.bright : bright
  })

  //音再生
  t.on("sound", (payload) => {
    Object.keys(clientSocket).forEach((key) => {
      const socket_id = clientSocket[key].socket_id
      if (socket_id && buttons[socket_id]) {
        buttons[socket_id].socket.emit("sound-command", {
          sound: payload.sound,
        })
      }
    })
  })

  //音声認識停止
  t.on("stop-speech-to-text", () => {
    Object.keys(clientSocket).forEach((key) => {
      const socket_id = clientSocket[key].socket_id
      if (socket_id && buttons[socket_id]) {
        buttons[socket_id].socket.emit("stop-speech-to-text")
      }
    })
  })

  //コマンド実行
  t.doCommand = function (payload) {
    if (payload.type == "button") {
      t.emit(payload.action, payload)
      sendCommand()
    }
  }

  setInterval(() => {
    sendCommand()
  }, 200)

  t.socket = function (name: string) {
    Object.keys(clientSocket).forEach((key) => {
      if (clientSocket[key].name === name) {
        const socket_id = clientSocket[key].socket_id
        if (socket_id && buttons[socket_id]) {
          return buttons[socket_id].socket
        }
      }
    })
    return null
  }

  return t
}

module.exports = ButtonClient

function main() {
  const t = ButtonClient({ port: 0, robotSecretKey: "" })
  t.emit("all-on")
}

if (require.main === module) {
  main()
}
