import { EventEmitter } from "events"
import { Flow } from "./libs/flow"
import { Node } from "./libs/node"
import { Core } from "./modules/core"
import { Operation } from "./modules/operation"
import { Quiz } from "./modules/quiz"
import { HTTP } from "./modules/http"
import { LED } from "./modules/led"
import { Nlp } from "./modules/nlp"

import * as utils from "./libs/utils"
const util = require("util")

const removeQuote = (str) => {
  if (!str) return str
  const t = str.trim().match(/"(.+)"/) || ["", str]
  return t[1]
}

const modules = []

export type DoraPlayProps = {
  socket: EventEmitter
  host?: string
  loggerHost?: string
  range: {
    start: number
    end?: number
  }
  defaults?: any
}

export { Node, Flow }

export class Dora {
  config
  labels
  global
  types
  nodes
  labelNodes
  _modname
  utils
  _errorInfo
  exec_node
  loader
  flow
  callback
  credential
  request

  constructor(config = {}) {
    this.config = config
    this.labels = {}
    this.global = {}
    this.types = {}
    this.nodes = []
    this.labelNodes = {}
    this.global = {}
    this._modname = "core"
    Core(this)
    this._modname = "op"
    Operation(this)
    this._modname = "quiz"
    Quiz(this)
    this._modname = "http"
    HTTP(this)
    this._modname = "led"
    LED(this)
    this._modname = "nlp"
    Nlp(this)
    this.utils = utils
    this._errorInfo = {}
  }

  load(filename, loader) {
    return new Promise((res) => loader(filename, res))
  }

  loadModule(name, mod, config = {}) {
    this._modname = name
    mod(this, config)
    modules.push({
      name,
      mod,
      config,
    })
  }

  registerType(name, node) {
    this.types[`${this._modname}.${name}`] = node
    if (this._modname === "core") {
      this.types[`${name}`] = node
    }
  }

  initNode(lines, flow) {
    const labels = {}
    this.nodes = []
    let speech = []
    lines.forEach((lineObj, _i) => {
      const line = lineObj.out
      const index = lineObj.index
      const node = new Node(flow)
      this.exec_node = node
      node.line = lineObj.code ? lineObj.code : lineObj.out
      node.index = index
      //コメント行
      if (line.indexOf("//") === 0) {
        this.types["comment"](node)
        node.name = "comment"
      }
      //ラベル行
      else if (line.indexOf(":") === 0) {
        const m = line.match(/^:(.+)$/)
        const l = m[1].split("/")
        if (labels[l[0]]) {
          throw new Error("ラベルが重複しています.")
        }
        flow.labels[l[0]] = 0
        labels[l[0]] = {
          node: node,
          line: index,
          option: l.slice(1).join("/"),
          value: 0,
        }
        this.types["label"](node, m[1])
        node.name = "label"
      }
      //ラベル行
      else if (line.indexOf("/label/") === 0) {
        const m = line.match(/^\/.+\/(.+)$/)
        const l = m[1].split("/")
        if (labels[l[0]]) {
          throw new Error("ラベルが重複しています.")
        }
        flow.labels[l[0]] = 0
        labels[l[0]] = {
          node: node,
          line: index,
          option: l.slice(1).join("/"),
          value: 0,
        }
        this.types["label"](node, m[1])
        node.name = "label"
      }
      //コントロール行
      else if (line.indexOf("/") === 0) {
        const m = line.match(/^\/(.+)$/)
        const t = m[1].match(/(.+?)\/(.*)/)
        if (t) {
          var cmd = t[1]
          var opt = removeQuote(t[2])
        } else {
          var cmd = m[1]
          var opt = null
        }
        if (cmd.match(/^[\d\.]*$/) || cmd.match(/^[\d\.]*s$/) || cmd.match(/^[\d\.]*秒$/)) {
          const t = cmd.match(/([\d\.]*)/)
          this.types["delay"](node, t[1])
          node.name = "delay"
        } else {
          node.options = opt
          if (cmd.indexOf(".") === 0) {
            const t = cmd.match(/\.(.+)/)
            if (opt !== null) {
              this.types["set"](node, `${t[1]}/${opt}`)
              node.name = "set"
            } else {
              this.types["get"](node, t[1])
              node.name = "get"
            }
          } else if (this.types[cmd]) {
            this.types[cmd](node, opt)
            node.name = cmd
          } else {
            throw new Error("存在しないコントロールです.")
          }
        }
        //スピーチ
      } else {
        this.types["text-to-speech"](node, line)
        node.name = "text-to-speech"
      }
      if (this.nodes.length > 0) {
        const n = this.nodes[this.nodes.length - 1]
        n.nextNode = node
      }
      this.nodes.push(node)
    })
    {
      const node = new Node(flow)
      node.line = "/end"
      node.index = lines[lines.length - 1].index
      this.types["end"](node)
      node.name = "end"
      if (this.nodes.length > 0) {
        const n = this.nodes[this.nodes.length - 1]
        n.nextNode = node
      }
      this.nodes.push(node)
    }
    this.labels = labels
    return flow
  }

  preprocessor(script) {
    const r = []
    const t = script
      .split("\r\n")
      .join("\n")
      .split("\n")
      .map((v, i) => {
        if (v === "" && i > 0) {
          return "/0s"
        }
        return v
      })
      .join("\n")
      .replace(/(\/\*[^*]*\*\/)|(^\/\/.*)/g, "//")
      .trim()
      .split("\n")
    t.forEach((v, i) => {
      const m = v.match(/^\/joinAll\/(.+)$/)
      if (m) {
        const l = `:JOIN-${utils.generateId()}`
        r.push({ out: l, code: v, index: i })
        r.push({ out: "/join", code: v, index: i })
        r.push({ out: `/joinLoop/${l}`, code: v, index: i })
        r.push({ out: `/other/${m[1]}`, code: v, index: i })
      } else {
        r.push({ out: v, index: i })
      }
    })
    return r
  }

  async parse(script, filename, loader = undefined) {
    if (!script) {
      throw new Error("スクリプトがありません。")
      return
    }
    if (typeof filename !== "string") {
      loader = filename
    }
    const lines = this.preprocessor(script)
    this.labelNodes = {}
    const flow = this.initNode(lines, new Flow(this))
    flow.filename = filename
    this.flow = flow
    Object.keys(this.labelNodes).forEach((key) => {
      const _key = key.slice(1)
      this.labelNodes[key].forEach((node) => {
        if (this.labels[_key]) {
          node.wires.push(this.labels[_key].node)
        } else {
          this.exec_node = node
          throw new Error(`ラベル '${key}' がみつかりません。`)
        }
      })
    })
    this.nodes.forEach((node) => {
      node.wires.push(node.nextNode)
    })
    for (var i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i]
      if (node.name == "call") {
        node.dora = async () => {
          const dora = new Dora(this.config)
          modules.forEach((m) => {
            dora._modname = m.name
            m.mod(dora, m.config)
          })
          const filename = node.options
          const script = await this.load(filename, loader)
          await dora.parse(script, filename, loader)
          dora.flow.parentFlow = this.flow
          return dora
        }
      }
    }
    this.loader = loader
  }

  async eval(node, msg, config, callback) {
    if (typeof msg.script === "undefined") {
      if (callback) callback(null, msg)
      return
    }
    const labels = msg.labels
    const _callback = (info, msg) => {
      msg.labels = labels
      if (callback) callback(info, msg)
    }
    const { script } = msg
    const { socket } = this.flow.options
    const dora = new Dora(config)
    modules.forEach((m) => {
      dora._modname = m.name
      m.mod(dora, m.config)
    })
    const s = typeof script === "string" ? script : script.join("\n")
    if (s === "") {
      _callback(null, msg)
      return
    }
    await dora.parse(s, this.loader)
    dora.flow.parentFlow = node.flow
    dora.flow.options = {
      range: {
        start: 0,
      },
      socket,
    }
    dora.callback = (err, msg) => {
      _callback(err, msg)
    }
    dora.flow.run(dora.nodes[0], msg)
  }

  play(msg, options: DoraPlayProps, callback) {
    if (!("callstack" in msg)) {
      msg.callstack = []
    }
    if (!this.credential) {
      this.credential = {}
    }
    this._errorInfo = {}
    if (this.flow) {
      this.flow.stop()
    }
    const labels = msg.labels
    const _callback = (info, msg) => {
      if (msg) msg.labels = labels
      if (callback) callback(info, msg)
    }
    this.callback = _callback
    this.flow.options = options
    const {
      range: { start, end },
    } = options
    if (start) {
      if (end && start > end) {
        this._errorInfo = {
          lineNumber: 0,
          code: "範囲実行エラー",
          reason: `無効な実行範囲です。開始行:${start} 終了行:${end}`,
        }
        return _callback(this._errorInfo, msg)
      }
      if (
        !this.nodes.some((v) => {
          if (v.index == start) {
            this.flow.run(v, msg)
            return true
          }
          return false
        })
      ) {
        this._errorInfo = {
          lineNumber: 0,
          code: "範囲実行エラー",
          reason: `${start}行がありません。`,
        }
        return _callback(this._errorInfo, msg)
      }
    } else {
      this.flow.run(this.nodes[0], msg)
    }
  }

  stop() {
    if (this.flow) {
      this.flow.stop()
    }
  }

  run(flow) {}

  err(err) {
    this.stop()
    if (this.callback) this.callback(err, null)
  }

  exec(flow, node, msg) {
    if (flow.isRunning()) {
      const {
        range: { start, end },
      } = flow.options
      let exitflag =
        (typeof end !== "undefined" && node.index >= end) ||
        (typeof start !== "undefined" && node.index < start)
      if (typeof start !== "undefined" && typeof end === "undefined") exitflag = false
      if (exitflag) {
        if (flow.runnode == 0 || flow.isRunning() == false) {
          flow.stop()
          delete msg._forks
          const m = utils.clone(msg)
          if (this.callback) this.callback(null, m)
        }
      } else {
        const m = utils.clone(msg)
        node.up()
        flow.up()
        this.exec_node = node
        flow.execNodes.push({ node, msg: m })
      }
    }
  }

  emit(flow, node, msg) {
    if (msg === null || typeof msg === "undefined") {
      return
    } else if (!util.isArray(msg)) {
      msg = [msg]
    }
    let numOutputs = node.wires.length
    for (var i = 0; i < numOutputs; i++) {
      if (i < msg.length) {
        const msg_one = msg[i]
        if (msg_one === null || typeof msg_one === "undefined") {
        } else {
          const next = node.wires[i]
          this.exec(flow, next, msg_one)
        }
      }
    }
    flow.exec()
  }

  join(flow, node, type) {
    if (type !== "force") {
      if (flow.runnode > 1) {
        flow.runnode--
        return false
      }
    }
    this.nodes.forEach((node) => node.stop())
    node.up()
    flow.runnode = 1
    return true
  }

  goto(flow, node, msg, labels) {
    if (flow && node) {
      node.down()
      flow.down()
      for (var i = 0; i < labels.length; i++) {
        const label = labels[i].slice(1)
        if (this.labels[label]) {
          this.exec(flow, this.labels[label].node, msg)
        }
      }
      flow.exec()
    }
  }

  send(flow, node, msg) {
    if (node) {
      node.down()
      flow.down()
      this.emit(flow, node, msg)
    }
  }

  end(flow, node, err, msg) {
    node.down()
    flow.down()
    if (flow.runnode == 0 || err || flow.isRunning() == false) {
      flow.stop()
      delete msg._forks
      const m = utils.clone(msg)
      if (this.callback) this.callback(err, m)
    }
  }

  nextLabel(node, label, index = 0) {
    if (typeof label === "undefined" || label === null) return []
    if (!util.isArray(label)) {
      label = label.split("/")
    }
    label = label.slice(index)
    for (var i = 0; i < label.length; i++) {
      const _label = label[i].trim()
      if (_label.indexOf(":") === 0) {
        if (!this.labelNodes[_label]) {
          this.labelNodes[_label] = []
        }
        this.labelNodes[_label].push(node)
      }
    }
    return label
  }

  errorInfo() {
    if (this.exec_node) {
      return {
        lineNumber: this.exec_node.index + 1,
        code: this.exec_node.line,
        reason: this.exec_node.reason,
      }
    }
    return this._errorInfo
  }
}
