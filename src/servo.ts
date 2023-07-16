const { SoftPWM } = require("raspi-soft-pwm")
import { config } from "~/config"

export default function Servo() {
  if (config.voiceHat) {
    return {
      pwm0: new SoftPWM("GPIO26"), //UP DOWN
      pwm1: new SoftPWM("GPIO6"), //LEFT RIGHT
      pwm2: new SoftPWM("GPIO25"), //status LED
    }
  } else {
    return {
      pwm0: new SoftPWM("GPIO22"), //UP DOWN
      pwm1: new SoftPWM("GPIO27"), //LEFT RIGHT
      pwm2: new SoftPWM("GPIO25"), //status LED
    }
  }
}
