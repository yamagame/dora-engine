const EventEmitter = require('events');

function sgn(a) {
  if (a < 0) return -1;
  if (a > 0) return 1;
  return 0;
}

function roundParam(p) {
  return parseInt(p*1000)/1000;
}

function abs(a) {
  if (a < 0) return -a;
  return a;
}

var t0 = 0;
var t1 = 0;

function Servo(center) {
  var t = new EventEmitter();

  t.center = center;
  t.initialCenter = center;
  t.target = center;
  t.now = center;
  t.speed = 0.08;

  t.update = function (mode) {
    const now = this.now;
    const adjust = (a, b) => {
      const d = this.target - this.now;
      if (abs(d) > a) {
        var q = d * this.speed;
        if (abs(q) > b) q = b * sgn(q);
        this.now += q;
        return true;
      } else {
        this.now = this.target;
        return false;
      }
    }
    const r = (mode == 'talking') ? adjust(0.0008, 0.0008) : adjust(0.0001, 0.0015);
    if (now != this.now) {
      this.emit('updated');
    }
    return r;
  }

  return t;
}

function Action(servo0, servo1) {
  var t = new EventEmitter();

  t.servo0 = servo0;
  t.servo1 = servo1;
  t.wait = 120;
  t.talkstep = 0;
  t.mode = 'idle';
  t.state = 'idle';

  t.setState = function (mode, state) {
    if (t.mode != mode || t.state != state) {
      t.mode = mode;
      t.state = state;
      t.emit(mode, state);
    }
  }

  t.idle = function (mode) {
    const u0 = this.servo0.update(this.state);
    const u1 = this.servo1.update(this.state);

    if (mode == 'left') {
      this.servo1.center = 0.055;
      return;
    } else
    if (mode == 'right') {
      this.servo1.center = 0.091;
      return;
    } else
    if (mode == 'center') {
      this.servo1.center = this.servo1.initialCenter;
      return;
    }

    if (u0 == false && u1 == false) {
      if (mode == 'idle') {
        this.setState(mode, 'idle');
        this.servo0.speed = 0.08;
        this.servo1.speed = 0.08;
        this.wait--;
        if (this.wait < 0) {
          this.wait = 60 + Math.random() * 120;
          const m = Math.floor(Math.random() * 3);
          if (m == 0) {
            if (abs(this.servo0.target - this.servo0.initialCenter) > 0.001) {
              this.servo0.target = this.servo0.initialCenter;
            } else
              if (abs(this.servo1.target - this.servo1.initialCenter) < 0.001) {
                this.servo1.target = roundParam(this.servo1.initialCenter + Math.random() * 0.05 - 0.025);
              } else {
                this.servo1.target = this.servo1.initialCenter;
              }
          } else
            if (m == 1) {
              this.servo0.target = roundParam(this.servo0.initialCenter + Math.random() * 0.015 - 0.0075);
            } else {
              if (abs(this.servo0.target - this.servo0.initialCenter) > 0.001) {
                this.servo0.target = this.servo0.initialCenter;
              } else {
                this.servo1.target = roundParam(this.servo1.initialCenter + Math.random() * 0.05 - 0.025);
              }
            }
        }
        this.talkstep = 0;
      } else
      if (mode == 'centering') {
        if (abs(this.servo0.target - this.servo0.center) > 0.001) {
          this.servo0.target = this.servo0.center;
          this.servo1.target = this.servo1.center;
        } else
        if (abs(this.servo1.target - this.servo1.center) > 0.001) {
          this.servo0.target = this.servo0.center;
          this.servo1.target = this.servo1.center;
        } else {
          this.setState(mode, 'ready');
        }
      } else
      if (mode == 'talk') {
        if (abs(this.servo0.target - this.servo0.center) > 0.001) {
          this.servo0.target = this.servo0.center;
          this.servo1.target = this.servo1.center;
        } else
          if (abs(this.servo1.target - this.servo1.center) > 0.001) {
            this.servo0.target = this.servo0.center;
            this.servo1.target = this.servo1.center;
            this.setState(mode, 'centering');
          } else {
            this.setState(mode, 'talking');
            this.servo0.speed = 0.1;
            switch (this.talkstep) {
            case 0:
              this.wait = parseInt(Math.random() * 10);
              this.talkstep = 1;
              break;
            case 1:
              if (this.wait > 0) {
                this.wait--;
              } else {
                this.talkstep = 0;
                this.servo0.target = this.servo0.center + (Math.random() * 0.0025 + 0.0025);
              }
              break;
            }
          }
      } else {
        this.servo0.target = this.servo0.center;
        this.servo1.target = this.servo1.center;
      }
      if (t1 != this.servo0.target) {
        console.log(`servo0 ${this.servo0.target}`);
        t1 = this.servo0.target;
      }
      if (t0 != this.servo1.target) {
        console.log(`servo1 ${this.servo1.target}`);
        t0 = this.servo1.target;
      }
    }

  }

  return t;
}

module.exports = {
  Action,
  Servo,
}
