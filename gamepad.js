const EventEmitter = require('events');
const HID = require('node-hid');
const usbDetect = require('usb-detection');

usbDetect.startMonitoring();

function HexString(buf) {
  if (typeof buf === 'number') {
    return buf.toString(16).toUpperCase();
  }
  return buf.toString('hex').toUpperCase();
}

function Pad4(buf) {
  return ('0000'+HexString(buf)).slice(-4);
}

class GamePad extends EventEmitter {
  constructor() {
    super();
    this.gamepads = {}
    this.devices = {
    }
    this.change();
  }

  add(vendorId, productId) {
    this.devices[`${Pad4(vendorId)}/${Pad4(productId)}`] = true;
    this.change();
  }

  remove(vendorId, productId) {
    delete this.devices[`${Pad4(vendorId)}/${Pad4(productId)}`];
    this.change();
  }

  checkId(dev) {
    const d = `${Pad4(dev.vendorId)}/${Pad4(dev.productId)}`;
    return (this.devices[d])
  }

  change() {
    const devices = HID.devices();
    devices.forEach( dev => {
      if (this.checkId(dev)) {
        if (typeof this.gamepads[dev.path] === 'undefined') {
          //console.log(`add ${dev.product}`);
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
                vendorId: Pad4(dev.vendorId),
                productId: Pad4(dev.productId),
                data: HexString(data),
              });
            }
          })
          device.on('error', err => {
            //console.log(`remove ${dev.product}`);
            delete this.gamepads[dev.path];
            device.close();
          })
        }
      }
    })
  }
}

const gamepad = new GamePad();

usbDetect.on('add', dev => {
  const d = `${Pad4(dev.vendorId)}/${Pad4(dev.productId)}`;
  console.log(`ID:${d} vendorID:${Pad4(dev.vendorId)} productID:${Pad4(dev.productId)} deviceName:${dev.deviceName} manufacturer:${dev.manufacturer}`);
})

usbDetect.on('change', dev => {
  setTimeout(() => {
    gamepad.change();
  }, 100);
})

module.exports = gamepad;

if (require.main === module) {
  if (process.argv.length > 2 && process.argv[2]) {
    gamepad.devices[process.argv[2]] = true;
  }
  gamepad.on('event', event => {
    const d = `${Pad4(event.vendorId)}/${Pad4(event.productId)}`;
    console.log(`ID:${d} data:${event.data}`);
  })
  gamepad.change();
}
