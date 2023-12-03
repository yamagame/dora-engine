import * as express from "express"
import { Server } from "http"
import { Server as SocketIOServer } from "socket.io"
import bodyParser from "body-parser"

const app = express()
const server = new Server(app)
const io = new SocketIOServer(server)

app.use(bodyParser.json({ type: "application/json" }))
app.use(bodyParser.raw({ type: "application/*" }))

import { config } from "./config"

const raspiMode = true

const pigpio = raspiMode ? require("pigpio") : {}
const raspi = raspiMode ? require("raspi") : {}

let led_mode = process.env.LED_MODE || "off"
let led_bright = process.env.LED_VALUE || 1
let buttonLevel = null

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

if (config.voiceHat && raspiMode) {
  pigpio.configureClock(5, 0)
}

if (raspiMode) {
  raspi.init(() => {
    const { Servo } = require("./servo")
    const servo = Servo()
    const led = require("./led-controller")()
    if (config.voiceHat) {
      servo.pwm2.write(led.now)
    } else {
      servo.pwm2.write(led.max - led.now)
    }
    led.on("updated", () => {
      if (config.voiceHat) {
        servo.pwm2.write(led.now)
      } else {
        servo.pwm2.write(led.max - led.now)
      }
    })
    setInterval(() => {
      led.idle(led_mode, led_bright)
    }, 20)

    let Gpio = require("pigpio").Gpio
    let button = new Gpio(23, {
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
  })
}

io.on("connection", function (socket) {
  console.log("connected", socket.id)
  socket.on("led-command", (payload, callback) => {
    changeLed(payload)
    if (callback) callback()
  })
  socket.on("disconnect", function () {
    console.log("disconnect")
  })
})

server.listen(config.gpioPort, () => console.log(`listening on port ${config.gpioPort}!`))

if (require.main === module) {
  let state = "off"
  const io = require("socket.io-client")
  const socket = io(`http://localhost:${config.gpioPort}`)
  socket.on("connect", () => {
    console.log("connected")
    socket.emit("led-command", { action: state })
  })
  socket.on("button", (data) => {
    console.log(data)
    if (data.state) {
      state = state === "on" ? "off" : "on"
    }
    socket.emit("led-command", { action: state })
  })
}
