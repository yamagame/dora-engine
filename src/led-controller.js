const EventEmitter = require("events");

module.exports = function () {
  var t = new EventEmitter();

  t.now = 0;
  t.max = 1;
  t.mode = "off";
  t.step = 0;
  t.blinkSpeed = 0.025;
  t.power_timer = 0;
  t.theta = 0;
  t.idleCounter = 0;
  t.idle = function (mode, value = 1) {
    t.idleCounter++;
    if (t.idleCounter > 60) t.idleCounter = 0;
    const now = t.now;
    if (t.mode !== mode) {
      if (mode == "off") {
        t.mode = mode;
      } else if (mode == "on") {
        t.mode = mode;
      } else if (mode == "blink") {
        t.mode = mode;
      } else if (mode == "talk") {
        t.mode = mode;
        t.step = 0;
        t.idleCounter = 0;
      }
      if (mode == "power") {
        t.mode = mode;
        t.power_timer = 50 * 10000;
      }
    }
    if (t.mode == "off") {
      t.now = 0;
    }
    if (t.mode == "on") {
      t.now = t.max;
    }
    if (t.mode == "power") {
      if (t.power_timer > 0) {
        if (t.power_timer % 50 < 25) {
          t.now = 0;
        } else {
          t.now = t.max;
        }
        t.power_timer--;
      }
    }
    if (t.mode == "blink") {
      t.now = ((Math.sin(t.theta) + 1) * t.max) / 2;
      t.theta += t.blinkSpeed;
      if (t.theta >= Math.PI * 2) {
        t.theta -= Math.PI * 2;
      }
    }
    if (t.mode == "talk") {
      if (t.talk > 0 || t.step > 0) {
        if (t.step == 0) {
          t.idleCounter = 15;
        }
        t.step = 1;
        t.idleCounter += Math.floor(Math.random() * Math.floor(5));
        if (t.idleCounter % 30 < 15) {
          t.now = t.max;
        } else {
          t.now = 0;
        }
      } else {
        t.now = 0;
      }
    }
    {
      t.max = value;
      if (t.now > t.max) t.now = t.max;
    }
    if (now != t.now) {
      t.emit("updated");
    }
  };

  t.resetTalk = () => {
    if (t.step !== 0) {
      if (t.now !== 0) {
        t.now = 0;
        t.emit("updated");
      }
    }
    t.step = 0;
    t.idleCounter = 0;
    t.talk = 0;
  };

  return t;
};
