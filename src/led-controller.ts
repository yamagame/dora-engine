import * as EventEmitter from "events"

class LedController extends EventEmitter {
  now = 0
  max = 1
  mode = "off"
  step = 0
  blinkSpeed = 0.025
  power_timer = 0
  theta = 0
  idleCounter = 0
  talk = 0

  constructor() {
    super()
  }

  idle(mode, value = 1) {
    this.idleCounter++
    if (this.idleCounter > 60) this.idleCounter = 0
    const now = this.now
    if (this.mode !== mode) {
      if (mode == "off") {
        this.mode = mode
      } else if (mode == "on") {
        this.mode = mode
      } else if (mode == "blink") {
        this.mode = mode
      } else if (mode == "talk") {
        this.mode = mode
        this.step = 0
        this.idleCounter = 0
      }
      if (mode == "power") {
        this.mode = mode
        this.power_timer = 50 * 10000
      }
    }
    if (this.mode == "off") {
      this.now = 0
    }
    if (this.mode == "on") {
      this.now = this.max
    }
    if (this.mode == "power") {
      if (this.power_timer > 0) {
        if (this.power_timer % 50 < 25) {
          this.now = 0
        } else {
          this.now = this.max
        }
        this.power_timer--
      }
    }
    if (this.mode == "blink") {
      this.now = ((Math.sin(this.theta) + 1) * this.max) / 2
      this.theta += this.blinkSpeed
      if (this.theta >= Math.PI * 2) {
        this.theta -= Math.PI * 2
      }
    }
    if (this.mode == "talk") {
      if (this.talk > 0 || this.step > 0) {
        if (this.step == 0) {
          this.idleCounter = 15
        }
        this.step = 1
        this.idleCounter += Math.floor(Math.random() * Math.floor(5))
        if (this.idleCounter % 30 < 15) {
          this.now = this.max
        } else {
          this.now = 0
        }
      } else {
        this.now = 0
      }
    }
    {
      this.max = value
      if (this.now > this.max) this.now = this.max
    }
    if (now != this.now) {
      this.emit("updated")
    }
  }

  resetTalk() {
    if (this.step !== 0) {
      if (this.now !== 0) {
        this.now = 0
        this.emit("updated")
      }
    }
    this.step = 0
    this.idleCounter = 0
    this.talk = 0
  }
}

module.exports = function () {
  return new LedController()
}
