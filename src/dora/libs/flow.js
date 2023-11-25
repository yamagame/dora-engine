const utils = require("./utils");

class Flow {
  constructor(engine, config) {
    this.engine = engine;
    this.runnode = 0;
    this.running = false;
    this.execNodes = [];
    this.parentFlow = null;
    this.labels = {};
  }

  run(node, msg) {
    msg.labels = this.labels;
    this.running = true;
    this.engine.exec(this, node, msg);
    this.exec();
  }

  exec() {
    const t = [];
    const m = [];
    for (var i = 0; i < this.execNodes.length; i++) {
      t.push(this.execNodes[i]);
      m.push(utils.clone(this.execNodes[i].msg));
    }
    this.execNodes = [];
    setTimeout(() => {
      for (var i = 0; i < t.length; i++) {
        if (t[i].node.isAlive()) {
          // const name = t[i].node.name;
          // if (name !== 'text-to-speech' && name !== 'delay') {
          //   delete m[i].silence;
          // }
          t[i].node.emit("input", m[i], m[i].callstack);
        }
      }
    }, 1);
  }

  stop(err) {
    this.running = false;
  }

  send(node, msg) {
    this.engine.send(this, node, msg);
  }

  err(err) {
    if (this.parentFlow) {
      this.parentFlow.err(err);
      return;
    }
    this.engine.err(err);
  }

  end(node, err, msg) {
    this.engine.end(this, node, err, msg);
  }

  up() {
    this.runnode++;
  }

  down() {
    this.runnode--;
  }

  nextLabel(node, label, index = 0) {
    return this.engine.nextLabel(node, label, index);
  }

  goto(node, msg, labels) {
    return this.engine.goto(this, node, msg, labels);
  }

  join(node) {
    this.engine.join(this, node);
  }

  isRunning() {
    if (this.parentFlow) {
      return this.parentFlow.isRunning();
    }
    return this.running;
  }

  credential() {
    if (this.parentFlow) {
      return this.parentFlow.credential();
    } else {
      return this.engine.credential;
    }
  }

  async request(command, options, params) {
    if (this.parentFlow) {
      return await this.parentFlow.request(command, options, params);
    } else {
      return await this.engine.request(command, options, params);
    }
  }
}

module.exports = Flow;
