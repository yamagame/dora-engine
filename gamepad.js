const EventEmitter = require('events');
const HID = require('node-hid');

function ArrayToHexString(buf) {
  return buf.toString('hex').toUpperCase();
}

class GamePad extends EventEmitter {
  constructor() {
    super();
    this.gamepads = {}
    this.intervalTimer = setInterval(() => {
      const devices = HID.devices();
      devices.forEach( dev => {
        if (dev.usagePage === 1
        && (dev.usage === 4 || dev.usage === 5)) {
          if (typeof this.gamepads[dev.path] === 'undefined') {
            // console.log(`attach ${dev.path}`);
            const device = new HID.HID(dev.path)
            this.gamepads[dev.path] = {
              data: null,
              path: dev.path,
              device,
            }
            device.on('data', data => {
              this.emit('data', data);
              if ((!this.gamepads[dev.path].data)
              || this.gamepads[dev.path].data.compare(data) !== 0) {
                this.gamepads[dev.path].data = data;
                this.emit('event', {
                  ...dev,
                  data: ArrayToHexString(data),
                });
              }
            })
            device.on('error', err => {
              // console.log(`detach ${dev.path}`);
              delete this.gamepads[dev.path];
              device.close();
            })
          }
        }
      })
    }, 1000);
  }
}

const gamepad = new GamePad();
module.exports = gamepad;

if (require.main === module) {
  gamepad.on('event', event => {
    console.log(event);
  })
}
