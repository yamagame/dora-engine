//首振り
const pigpio = require('pigpio');
const raspi = require('raspi');
const Servo = require('./action').Servo;
const Action = require('./action').Action;
const config = require('./config');

if (config.voice_hat) {
  pigpio.configureClock(5, 0);
}

var mode = process.env.MODE || 'idle';
var led_mode = process.env.LED_MODE || 'off';
var led_bright = process.env.LED_VALUE || 1;
var buttonLevel = null;

const servo0 = Servo(0.073);	//UP DOWN
const servo1 = Servo(0.073);	//LEFT RIGHT
const servoAction = Action(servo0, servo1);

function startServo() {
  const servo = require('./servo')();
  const led = require('./led-controller')();
  servo.pwm0.write(servo0.now);	//UP DOWN
  servo.pwm1.write(servo1.now);	//LEFT RIGHT
  servo.pwm2.write(led.now);
  servo0.on('updated', () => {
    servo.pwm0.write(servo0.now);
  })
  servo1.on('updated', () => {
    servo.pwm1.write(servo1.now);
  })
  led.on('updated', () => {
    servo.pwm2.write(led.now);
  })
  setInterval(() => {
    servoAction.idle(mode);
    led.idle(led_mode);
  }, 20);
}

function changeLed(payload) {
  if (payload.action === 'off') {
    led_mode = 'off';
  }
  if (payload.action === 'on') {
    led_mode = 'on';
  }
  if (payload.action === 'blink') {
    led_mode = 'blink';
  }
  if (payload.action === 'power') {
    led_mode = 'power';
  }
  if (payload.action === 'active') {
    led_mode = 'off';
  }
  if (payload.action === 'deactive') {
    led_mode = 'on';
  }
  led_bright = (typeof payload.value !== 'undefined') ? payload.value : led_bright;
  console.log(`led_mode ${led_mode} led_bright ${led_bright} `);
}

raspi.init(() => {
  startServo();

  const app = require('http').createServer(handler)
  const io = require('socket.io')(app);
  
  function handler (req, res) {
    res.end();
  }

  app.listen(3091);

  io.on('connection', function(socket) {
    console.log('connected', socket.id);
    
    socket.on('led-command', (payload, callback) => {
      changeLed(payload);
      if (callback) callback();
    });
    
    socket.on('disconnect', function() {
      console.log('disconnect');
    });
    
    socket.on('message', function(payload, callback) {
      try {
        const { action, direction } = payload;
        if (action === 'centering') {
          mode = 'centering';
        } else
        if (action === 'talk' || action === 'idle' || action === 'stop') {
          mode = action;
          if (direction) {
            servoAction.idle(direction);
          }
        } else
        if (action === 'led-on' || action === 'led-off' || action === 'led-blink') {
          led_mode = action.toString().split('-')[1];
        }
        if (callback) {
          if (action === 'centering') {
            //首が正面を向くまで待つ
            function change(state) {
              if (state === 'ready') {
                callback({ action });
                servoAction.removeListener('centering', change);
              }
            }
            servoAction.on('centering', change);
          } else {
            callback({ action });
          }
        }
      } catch(err) {
      }
    });
  });

  var Gpio = require('pigpio').Gpio;
  var button = new Gpio(23, {
    mode: Gpio.INPUT,
    pullUpDown: Gpio.PUD_DOWN,
    edge: Gpio.EITHER_EDGE
  })
  
  button.on('interrupt', function(level) {
    if (buttonLevel != level) {
      buttonLevel = level;
      io.emit('button', { level: level, state: (level==0) });
    }
  });

  setInterval(() => {
    const level = button.digitalRead();
    if (buttonLevel != level) {
      buttonLevel = level;
      io.emit('button', { level: level, state: (level==0) });
    }
  }, 1000)
});
