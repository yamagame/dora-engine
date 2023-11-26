import { Flow } from "./flow"
const Emitter = require("component-emitter")
const utils = require("./utils")

export class Node extends Emitter {
  flow: Flow

  constructor(flow: Flow) {
    super()
    this.flow = flow
    this.wires = []
    this._act = 0
    this.line = 0
    this.reason = ""
  }

  global() {
    return this.flow.engine.global
  }

  credential() {
    return this.flow.credential()
  }

  status(status) {}

  send(msg) {
    if (!this.isAlive()) return
    this.flow.send(this, msg)
  }

  err(err) {
    this.flow.err(err)
  }

  fork(msg) {
    const w = []
    if (this.wires.length <= 1) {
      const m = utils.clone(msg)
      //m.topic = this.wires[i].labelName;
      m.topicPriority = typeof m.topicPriority !== "undefined" ? m.topicPriority : 0
      w.push(m)
    } else {
      for (var i = 0; i < this.wires.length - 1; i++) {
        const m = utils.clone(msg)
        m.topic = this.wires[i].labelName
        m.topicPriority = typeof m.topicPriority !== "undefined" ? m.topicPriority : 0
        w.push(m)
      }
      w.push(null)
    }
    this.send(w)
  }

  jump(msg) {
    const w = []
    if (this.wires.length - 1 > 0) {
      for (var i = 0; i < this.wires.length - 1; i++) {
        w.push(msg)
      }
      w.push(null)
    } else {
      w.push(msg)
    }
    this.send(w)
  }

  next(msg) {
    const w = []
    for (var i = 0; i < this.wires.length - 1; i++) {
      w.push(null)
    }
    w.push(msg)
    this.send(w)
  }

  end(err, msg) {
    this.flow.end(this, err, msg)
  }

  up() {
    this._act++
  }

  down() {
    this._act--
  }

  stop() {
    this._act = 0
  }

  isAlive() {
    return this._act != 0
  }

  nextLabel(label, index = 0) {
    return this.flow.nextLabel(this, label, index)
  }

  join(type) {
    return this.flow.join(this, type)
  }

  goto(msg, labels) {
    return this.flow.goto(this, msg, labels)
  }

  toJSON(key) {
    return {
      line: this.line,
      index: this.index,
      name: this.name,
    }
  }

  getField(msg, field) {
    console.log(field)
    let index = field.length
    let object = msg
    do {
      const key = field[field.length - index]
      console.log(key)
      if (index <= 1) {
        if (object[key] !== null) {
          return { key, object }
        }
        return null
      }
      object = object[key]
      index--
    } while (object)
    return null
  }
}
