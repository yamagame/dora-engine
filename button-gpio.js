const app = require('express')()
const server = require('http').Server(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser')

app.use(bodyParser.json({ type: 'application/json' }))
app.use(bodyParser.raw({ type: 'application/*' }))

const config = require('./config');

const raspiMode = true;

const pigpio = raspiMode ? require('pigpio') : {};
const raspi = raspiMode ? require('raspi') : {};

var led_mode = process.env.LED_MODE || 'off';
var led_bright = process.env.LED_VALUE || 1;
var buttonLevel = null;

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
  //console.log(`led_mode ${led_mode} led_bright ${led_bright} `);
}

if (config.voice_hat && raspiMode) {
  pigpio.configureClock(5, 0);
}

if (raspiMode) {
  raspi.init(() => {
    const servo = require('./servo')();
    const led = require('./led-controller')();
    servo.pwm2.write(led.now);
    led.on('updated', () => {
      servo.pwm2.write(led.now);
    })
    setInterval(() => {
      led.idle(led_mode, led_bright);
    }, 20);

    var Gpio = require('pigpio').Gpio;
    var button = new Gpio(23, {
      mode: Gpio.INPUT,
      pullUpDown: Gpio.PUD_DOWN,
      edge: Gpio.EITHER_EDGE
    })
    
    button.on('interrupt', function (level) {
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
}

io.on('connection', function (socket) {
  console.log('connected', socket.id);
  socket.on('led-command', (payload, callback) => {
    changeLed(payload);
    if (callback) callback();
  });
  socket.on('disconnect', function () {
    console.log('disconnect');
  });
})

server.listen(config.gpio_port, () => console.log(`listening on port ${config.gpio_port}!`))

if (require.main === module) {
  let state = 'off';
  const io = require('socket.io-client');
  const socket = io(`http://localhost:${config.gpio_port}`);
  socket.on('connect', () => {
    console.log('connected');
    socket.emit('led-command', { action :state });
  });
  socket.on('button', (data) => {
    console.log(data);
    if (data.state) {
      state = (state === 'on') ? 'off': 'on';
    }
    socket.emit('led-command', { action :state });
  });
}
