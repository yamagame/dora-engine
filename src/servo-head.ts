//首振り
const pigpio = require("pigpio")
const raspi = require("raspi")
const { Servo } = require("./action")
const Action = require("./action").Action
import { config } from "~/config"
const port = config.gpioPort
const fs = require("fs")
const path = require("path")
const gamepad = config.useGamePad ? require("./gamepad") : null
const basedir = path.join(__dirname, "..")

function loadSetting() {
  try {
    return JSON.parse(fs.readFileSync(path.join(basedir, "servo-head.json")))
  } catch (err) {}
  return {
    servo0: 0.073,
    servo1: 0.073,
  }
}
function saveSetting(servo0, servo1) {
  const data = {
    ...setting,
  }
  data.servo0 = servo0.initialCenter
  data.servo1 = servo1.initialCenter
  try {
    fs.writeFileSync(path.join(basedir, "servo-head.json"), JSON.stringify(data))
  } catch (err) {}
}
const setting = loadSetting()

if (config.voiceHat) {
  pigpio.configureClock(5, 0)
}

var mode = process.env.MODE || "idle"
var led_mode = process.env.LED_MODE || "off"
var led_bright = process.env.LED_VALUE || 1
var buttonLevel = null

const servo0 = Servo(setting.servo0) //UP DOWN
const servo1 = Servo(setting.servo1) //LEFT RIGHT
const servoAction = Action(servo0, servo1)

function roundParam(p) {
  return (p * 10000) / 10000
}

function abs(a) {
  if (a < 0) return -a
  return a
}

function startServo() {
  const servo = require("./servo")()
  const led = require("./led-controller")()
  servo.pwm0.write(servo0.now) //UP DOWN
  servo.pwm1.write(servo1.now) //LEFT RIGHT
  if (config.voiceHat) {
    servo.pwm2.write(led.now)
  } else {
    servo.pwm2.write(led.max - led.now)
  }
  servo0.on("updated", () => {
    servo.pwm0.write(roundParam(servo0.now))
  })
  servo1.on("updated", () => {
    servo.pwm1.write(roundParam(servo1.now))
  })
  led.on("updated", () => {
    if (config.voiceHat) {
      servo.pwm2.write(led.now)
    } else {
      servo.pwm2.write(led.max - led.now)
    }
  })
  setInterval(() => {
    servoAction.idle(mode)
    if (mode !== "talk") {
      led.resetTalk()
    }
    led.talk = abs(servo0.target - servo0.center)
    led.idle(led_mode, led_bright)
  }, 20)
}

function changeLed(payload) {
  if (payload.action === "off") {
    led_mode = "off"
  }
  if (payload.action === "on") {
    led_mode = "on"
  }
  if (payload.action === "blink") {
    led_mode = "blink"
  }
  if (payload.action === "talk") {
    led_mode = "talk"
  }
  if (payload.action === "power") {
    led_mode = "power"
  }
  if (payload.action === "active") {
    led_mode = "off"
  }
  if (payload.action === "deactive") {
    led_mode = "on"
  }
  led_bright = typeof payload.value !== "undefined" ? payload.value : led_bright
  //console.log(`led_mode ${led_mode} led_bright ${led_bright} `);
}

raspi.init(() => {
  startServo()

  const app = require("http").createServer(handler)
  const io = require("socket.io")(app)

  function requestHandler(req, callback) {
    let buf = Buffer.from([])
    req.on("data", (data) => {
      buf = Buffer.concat([buf, data])
    })
    req.on("close", () => {})
    req.on("end", () => {
      callback(buf.toString())
    })
  }

  function handler(req, res) {
    if (req.method === "POST") {
      const url = require("url").parse(req.url)
      const params = require("querystring").parse(url.search)
      req.params = params

      // curl -X POST -d '{"h":100,"v":200}' http://localhost:3091/center
      if (url.pathname === "/center" || url.pathname === "/reset") {
        return requestHandler(req, (data) => {
          try {
            const p = JSON.parse(data)
            if (typeof p.v !== "undefined") {
              console.log(`vertical ${p.v}`)
              servo0.initialCenter = parseFloat(p.v)
              servo0.center = servo0.initialCenter
            }
            if (typeof p.h !== "undefined") {
              console.log(`horizontal ${p.h}`)
              servo1.initialCenter = parseFloat(p.h)
              servo1.center = servo1.initialCenter
            }
          } catch (err) {}
          if (url.pathname === "/reset") {
            servo0.initialCenter = 0.073
            servo0.center = servo0.initialCenter
            servo1.initialCenter = 0.073
            servo1.center = servo1.initialCenter
          }
          mode = "centering"
          res.end("OK\n")
        })
      }

      // curl -X POST http://localhost:3091/stop
      if (url.pathname === "/stop") {
        return requestHandler(req, (data) => {
          mode = "stop"
          res.end("OK\n")
        })
      }

      // curl -X POST http://localhost:3091/idle
      if (url.pathname === "/idle") {
        return requestHandler(req, (data) => {
          mode = "idle"
          res.end("OK\n")
        })
      }

      // curl -X POST http://localhost:3091/talk
      if (url.pathname === "/talk") {
        return requestHandler(req, (data) => {
          mode = "talk"
          res.end("OK\n")
        })
      }

      // curl -X POST http://localhost:3091/save
      if (url.pathname === "/save") {
        return requestHandler(req, (data) => {
          saveSetting(servo0, servo1)
          res.end("OK\n")
        })
      }

      // curl -X POST http://localhost:3091/exit
      if (url.pathname === "/exit") {
        return requestHandler(req, (data) => {
          mode = "exit"
          led_mode = "off"
          setTimeout(() => {
            res.end("OK\n", () => {
              console.log("exit")
              process.exit(0)
            })
          }, 3000)
        })
      }
    }
    res.end()
  }

  app.listen(port, () => {
    console.log(`servo-head listening on port ${port}!`)
  })

  io.on("connection", function (socket) {
    console.log("connected", socket.id, socket.handshake.address)
    if (config.credentialAccessControl) {
      if (config.localhostIPs.indexOf(socket.handshake.address) === -1) {
        console.log("permission denied")
        return
      }
    }
    console.log("start action")

    socket.on("led-command", (payload, callback) => {
      changeLed(payload)
      if (callback) callback()
    })

    socket.on("disconnect", function () {
      console.log("disconnect")
    })

    socket.on("message", function (payload, callback) {
      if (mode === "exit") {
        if (callback) callback()
        return
      }
      try {
        const { action, direction } = payload
        if (action === "centering") {
          mode = "centering"
        } else if (action === "talk" || action === "idle" || action === "stop") {
          mode = action
          if (direction) {
            servoAction.idle(direction)
          }
        } else if (
          action === "led-on" ||
          action === "led-off" ||
          action === "led-blink" ||
          action === "led-talk"
        ) {
          led_mode = action.toString().split("-")[1]
          led_bright = 1
        }
        if (callback) {
          if (action === "centering") {
            //首が正面を向くまで待つ
            const change = (state) => {
              if (state === "ready") {
                callback({ action })
                servoAction.removeListener("centering", change)
              }
            }
            servoAction.on("centering", change)
          } else {
            callback({ action })
          }
        }
      } catch (err) {
        if (callback) callback()
      }
    })

    socket.on("gamepad", (payload, callback) => {
      if (config.useGamePad) {
        const { action, vendorId, productId } = payload
        if (action === "add") {
          gamepad.add(vendorId, productId)
        }
        if (action === "remove") {
          gamepad.remove(vendorId, productId)
        }
      }
      if (callback) callback()
    })
  })

  var Gpio = require("pigpio").Gpio
  var button = new Gpio(23, {
    mode: Gpio.INPUT,
    pullUpDown: Gpio.PUD_DOWN,
    edge: Gpio.EITHER_EDGE,
  })

  button.on("interrupt", function (level) {
    if (!config.voiceHat) level = 1 - level
    if (buttonLevel != level) {
      buttonLevel = level
      io.emit("button", { level: level, state: level == 0 })
    }
  })

  setInterval(() => {
    let level = button.digitalRead()
    if (!config.voiceHat) level = 1 - level
    if (buttonLevel != level) {
      buttonLevel = level
      io.emit("button", { level: level, state: level == 0 })
    }
  }, 1000)

  if (config.useGamePad) {
    gamepad.on("event", (event) => {
      io.emit("gamepad", event)
    })
  }
})
