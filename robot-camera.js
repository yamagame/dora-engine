const EventEmitter = require('events');

module.exports = class Camera extends EventEmitter {

  constructor() {
    super();
    this._eventTime = 60;
    this.counter = this._eventTime-10;
    this.nowInfo = [];
    this.info = [];
    this.timer = null;
    this.timeoutTimer = 0;
  }
  
  set eventTime(val) {
    this.counter = val - 10;
    this._eventTime = val;
  }
  
  get eventTime() {
    return this._eventTime;
  }
  
  parse(body) {
    const data = body.toString().split(',');
    const obj = [];
    let key = 0;
    data.forEach( (v,i) => {
      if ((i % 2) == 0) {
        key = v;
      } else {
        obj.push({ key, area: v });
      }
    })
    return obj;
  }
  
  area(a, b) {
    const d = (a.area > b.area) ? a.area - b.area : b.area - a.area;
    const e = (a.area > b.area) ? b.area : a.area;
    return parseInt(d/(e/2));
  }
  
  compare(a, b) {
    const d = a.length - b.length;
    let r = ((d < 0) ? (-d) : d)*5;
    if (a.length < b.length) {
      a.forEach( (v, i) => {
        r += this.area(v, b[i])*5;
      })
    } else {
      b.forEach( (v, i) => {
        r += this.area(v, a[i])*5;
      })
    }
    return r;
  }
  
  idle(info) {
    try {
      if (info.length > 0) {
        if (this.counter <= 0) {
          this.counter = this._eventTime - 10;
        }
        this.counter ++;
        const t = this.compare(this.info, info);
        if (t > 0) {
          this.counter += t;
          this.info = JSON.parse(JSON.stringify(info));
        }
      } else
      if (this.counter > 0) {
        this.counter -= 5;
        if (this.counter < 0) this.counter = 0;
      }
      console.log(this.counter,this._eventTime);
      if (this.counter >= this._eventTime) {
        this.counter = 1;
        if (info.length > 0) {
          return true;
        }
      }
      return false;
    } catch(err) {
      console.error(err);
    }
  }
  
  up(info) {
    this.timeoutTimer = 0;
    this.nowInfo = info;
    if (!this.timer) {
      this.timer = setInterval(() => {
        if (this.idle(this.nowInfo)) {
          this.emit('change', {});
        }
        this.timeoutTimer ++;
        if (this.timeoutTimer > 3*60) {
          this.timeoutTimer = 0;
          clearInterval(this.timer);
          this.timer = null;
        }
      }, 1000);
    }
  }
  
}

if (require.main === module) {
  const camera = new Camera();
  console.log(camera.hello());
}
