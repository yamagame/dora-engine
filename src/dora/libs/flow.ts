import { Dora } from ".."

const utils = require("./utils")

export class Flow {
  engine: Dora
  runnode
  running
  execNodes
  parentFlow
  labels
  options

  constructor(engine, config = {}) {
    this.engine = engine
    this.runnode = 0
    this.running = false
    this.execNodes = []
    this.parentFlow = null
    this.labels = {}
  }

  run(node, msg) {
    msg.labels = this.labels
    this.running = true
    this.engine.exec(this, node, msg)
    this.exec()
  }

  exec() {
    const t = []
    for (var i = 0; i < this.execNodes.length; i++) {
      t.push([this.execNodes[i], utils.clone(this.execNodes[i].msg)])
    }
    this.execNodes = []
    setImmediate(() => {
      t.forEach(([v, m]) => {
        if (v.node.isAlive()) {
          v.node.emit("input", m, m.callstack)
        }
      })
    })
  }

  stop(err) {
    this.running = false
  }

  send(node, msg) {
    this.engine.send(this, node, msg)
  }

  err(err) {
    if (this.parentFlow) {
      this.parentFlow.err(err)
      return
    }
    this.engine.err(err)
  }

  end(node, err, msg) {
    this.engine.end(this, node, err, msg)
  }

  up() {
    this.runnode++
  }

  down() {
    this.runnode--
  }

  nextLabel(node, label, index = 0) {
    return this.engine.nextLabel(node, label, index)
  }

  goto(node, msg, labels) {
    return this.engine.goto(this, node, msg, labels)
  }

  join(node, type) {
    return this.engine.join(this, node, type)
  }

  isRunning() {
    if (this.parentFlow) {
      return this.parentFlow.isRunning()
    }
    return this.running
  }

  credential() {
    if (this.parentFlow) {
      return this.parentFlow.credential()
    } else {
      return this.engine.credential
    }
  }

  async request(command, options = null, params = null) {
    if (this.parentFlow) {
      return await this.parentFlow.request(command, options, params)
    } else {
      return await this.engine.request(command, options, params)
    }
  }
}
