import { Node } from ".."
const utils = require("../libs/utils")
import { QuizOK, QuizOKImage, QuizNG, QuizNGImage, QuizCategory, QuizSlide } from "./quiz"

function Add(node, msg, options, isTemplated, sign) {
  let message = options
  if (isTemplated) {
    message = utils.mustache.render(message, msg)
  }
  const params = message.split("/")
  const field = params[0].split(".").filter((v) => v !== "")
  const result = node.getField(msg, field)
  if (result !== null) {
    const { object, key } = result
    const value = Number(params[1] || 1)
    object[key] = Number(object[key] || 0)
    object[key] += sign * value
  }
}

export const resetRandomTable = (node: Node, length: number) => {
  if (node._counter === 0) {
    node._randtable = new Array(length).fill(0).map((_, i) => i)
    for (var i = 0; i < length * 3; i++) {
      const a = utils.randInteger(0, length)
      const b = utils.randInteger(0, length)
      const c = node._randtable[a]
      node._randtable[a] = node._randtable[b]
      node._randtable[b] = c
    }
  }
}

export const textToSpeech = (node: Node, msg, credential, message, callback = null) => {
  const { socket } = node.flow.options
  delete msg.slot
  delete msg.match
  const params: {
    speed?
    volume?
    voice?
    languageCode?
    audioEncoding?
    ssmlGender?
    speakingRate?
    pitch?
    name?
    host?
    voiceId?
  } = {}
  if (typeof msg.speech !== "undefined") {
    //aquesTalk Pi向けパラメータ
    if (typeof msg.speech.speed !== "undefined") {
      params.speed = msg.speech.speed
    }
    if (typeof msg.speech.volume !== "undefined") {
      params.volume = msg.speech.volume
    }
    if (typeof msg.speech.voice !== "undefined") {
      params.voice = msg.speech.voice
    }
    //google text-to-speech向けパラメータ
    if (typeof msg.speech.languageCode !== "undefined") {
      params.languageCode = msg.speech.languageCode
    }
    if (typeof msg.speech.audioEncoding !== "undefined") {
      params.audioEncoding = msg.speech.audioEncoding
    }
    if (typeof msg.speech.gender !== "undefined") {
      params.ssmlGender = msg.speech.gender
    }
    if (typeof msg.speech.rate !== "undefined") {
      params.speakingRate = msg.speech.rate
    }
    if (typeof msg.speech.pitch !== "undefined") {
      params.pitch = msg.speech.pitch
    }
    if (typeof msg.speech.name !== "undefined") {
      params.name = msg.speech.name
    }
    if (typeof msg.speech.host !== "undefined") {
      params.host = msg.speech.host
    }
    //AWS Polly向けパラメータ
    if (typeof msg.speech.voiceId !== "undefined") {
      params.voiceId = msg.speech.voiceId
    }
  }
  if (msg.silence) {
    if (msg.payload !== "") {
      msg.payload += "\n"
    }
    msg.payload += message
    if (callback) {
      callback(msg)
    } else {
      node.send(msg)
    }
  } else if (message === "") {
    msg.payload = message
    if (callback) {
      callback(msg)
    } else {
      node.send(msg)
    }
  } else {
    socket.emit(
      "text-to-speech",
      {
        message,
        ...params,
        ...credential,
      },
      (res) => {
        if (!node.isAlive()) return
        msg.payload = message
        if (callback) {
          callback(msg)
        } else {
          node.send(msg)
        }
      }
    )
  }
}

export const Core = function (DORA, config = {}) {
  /**
   *  現在時刻を記録
   *  /now
   */
  function Now(node, options) {
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject()
      const now = new Date()
      msg.now = {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        date: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        day: now.getDay(),
      }
      msg.timestamp = now
      node.send(msg)
    })
  }
  DORA.registerType("now", Now)

  /*
   *
   *
   */
  function CoreLog(node: Node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      const { socket } = node.flow.options
      let logstr = ""
      try {
        let message = options || msg
        if (isTemplated) {
          message = utils.mustache.render(message, msg)
        }
        logstr = message
      } catch (err) {
        logstr = options
      }
      console.log(`log-->\n${logstr}\n<--log`)
      utils.logMessage(node, socket, logstr)
      node.send(msg)
    })
  }
  DORA.registerType("log", CoreLog)

  /*
   *
   *
   */
  function CoreError(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      var message = options || msg.payload
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      node.err(new Error(message))
    })
  }
  DORA.registerType("error", CoreError)

  /*
   *
   *
   */
  function CoreComment(node, options) {
    node.on("input", function (msg) {
      node.send(msg)
    })
  }
  DORA.registerType("comment", CoreComment)

  /*
   *
   *
   */
  function CoreLabel(node, options) {
    const p = options.split("/")
    const name = p[0]
    const args = p.slice(1)
    const m = name.match(/^\:(.+)/)
    node.labelName = name
    if (m) {
      node.labelName = m[1]
    }
    node.on("input", function (msg) {
      if (typeof this.flow.labels[node.labelName] === "undefined") {
        this.flow.labels[node.labelName] = 0
      }
      if (typeof msg.labels[node.labelName] !== "undefined") {
        this.flow.labels[node.labelName] = msg.labels[node.labelName]
      }
      this.flow.labels[node.labelName]++
      msg.labels = this.flow.labels
      node.send(msg)
    })
  }
  DORA.registerType("label", CoreLabel)

  /*
   * /if/こんにちは/:label
   * payload に指定した文字が含まれていれば label へ移動
   */
  function CoreIf(node, options) {
    const params = options.split("/")
    var string = params[0]
    const isTemplated = (string || "").indexOf("{{") != -1
    if (params.length > 1) {
      node.nextLabel(params.slice(1).join("/"))
    } else {
      throw new Error("ラベルを指定してください。")
    }
    node._counter = 0
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject()
      let message = string
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      if (typeof msg.payload !== "undefined" && utils.match(msg, message)) {
        const words = params.length > 1 && params.slice(1).filter((v) => v[0] !== ":")
        if (words && words.length > 0) {
          resetRandomTable(node, words.length)
          const message = words[node._randtable[node._counter]]
          node._counter++
          if (node._counter >= words.length) {
            node._counter = 0
          }
          textToSpeech(node, msg, this.credential(), message, (msg) => {
            node.jump(msg)
          })
        } else {
          node.jump(msg)
        }
      } else {
        node.next(msg)
      }
    })
  }
  DORA.registerType("if", CoreIf)

  /*
   * /goto/:label
   * label へ移動
   */
  function CoreGoto(node, options) {
    if (node.nextLabel(options).length <= 0) throw new Error("ラベルを指定してください。")
    node.on("input", function (msg) {
      node.jump(msg)
    })
  }
  DORA.registerType("goto", CoreGoto)

  /*
   *
   *
   */
  function CoreGosub(node, options) {
    if (node.nextLabel(options).length <= 0) throw new Error("ラベルを指定してください。")
    node.on("input", function (msg, stack) {
      stack.push(node.wires[node.wires.length - 1])
      node.jump(msg)
    })
  }
  DORA.registerType("gosub", CoreGosub)

  /*
   *
   *
   */
  function CoreReturn(node, options) {
    node.on("input", function (msg, stack) {
      if (stack.length <= 0) {
        return node.err(new Error("gosubが呼ばれていません"))
      }
      node.wires = [stack.pop()]
      node.send(msg)
    })
  }
  DORA.registerType("return", CoreReturn)

  /*
   *  ランダムに遷移
   *  /goto.random/:A/:B/:C
   */
  function CoreGotoRandom(node, options) {
    if (node.nextLabel(options).length <= 0) throw new Error("ラベルを指定してください。")
    node._counter = 0
    node.on("input", function (msg) {
      const length = node.wires.length - 1
      resetRandomTable(node, length)
      const t = node.wires.map((v) => {
        return null
      })
      t[node._randtable[node._counter]] = msg
      node._counter++
      if (node._counter >= length) {
        node._counter = 0
      }
      node.send(t)
    })
  }
  DORA.registerType("goto.random", CoreGotoRandom)

  /*
   *  ラベル順に遷移
   *  /goto.sequence/:A/:B/:C
   */
  function CoreGotoSequence(node, options) {
    if (node.nextLabel(options).length <= 0) throw new Error("ラベルを指定してください。")
    node._counter = 0
    node.on("input", function (msg) {
      const t = node.wires.map((v) => {
        return null
      })
      t[node._counter] = msg
      node._counter++
      if (node._counter >= node.wires.length - 1) {
        node._counter = 0
      }
      node.send(t)
    })
  }
  DORA.registerType("goto.sequence", CoreGotoSequence)

  /*
   *
   *
   */
  function CoreDelay(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      let rate = typeof msg.defaultInterval === "undefined" ? 1 : parseFloat(msg.defaultInterval)
      let delay = options
      if (isTemplated) {
        delay = utils.mustache.render(delay, msg)
      }
      if (msg.silence) {
        msg.payload += "\n"
      } else {
        if (delay === "0") {
          await utils.timeout(1000 * rate)
        } else {
          await utils.timeout(1000 * parseFloat(delay) * rate)
        }
      }
      node.send(msg)
    })
  }
  DORA.registerType("delay", CoreDelay)

  /*
   *
   *
   */
  function CoreEnd(node, options) {
    node.on("input", function (msg) {
      node.end(null, msg)
    })
  }
  DORA.registerType("end", CoreEnd)

  /*
   *
   *
   */
  function CoreFork(node, options) {
    node.nextLabel(options)
    node.on("input", function (msg) {
      var forkid = utils.generateId()
      if (!node.global()._forks) {
        node.global()._forks = {}
      }
      if (!node.global()._forks[forkid]) {
        node.global()._forks[forkid] = {}
      }
      var forks = node.global()._forks[forkid]
      var numOutputs = node.wires.length - 1
      if (!msg._forks) msg._forks = []
      msg._forks.push(forkid)
      forks.numWire = numOutputs
      forks.priority = 0
      forks.name = ""
      forks.msg = {}
      node.fork(msg)
    })
  }
  DORA.registerType("fork", CoreFork)

  /*
   *
   *
   */
  function CorePush(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      if (!msg.stack) msg.stack = []
      let message = options
      if (message === null) {
        message = msg.payload
      }
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      msg.stack.push(message)
      node.send(msg)
    })
  }
  DORA.registerType("push", CorePush)

  /*
   *
   *
   */
  function CorePop(node, options) {
    node.on("input", function (msg) {
      if (!msg.stack) msg.stack = []
      msg.payload = msg.stack.pop()
      node.send(msg)
    })
  }
  DORA.registerType("pop", CorePop)

  /*
   *
   *
   */
  function CoreJoin(node, options) {
    node.nextLabel(options)
    node.on("input", function (msg) {
      let freeze = false
      if (msg._forks && msg._forks.length > 0) {
        const forkid = msg._forks[msg._forks.length - 1]
        if (this.global()._forks && this.global()._forks[forkid]) {
          var forks = this.global()._forks[forkid]
          if (typeof msg.topicPriority !== "undefined" && forks.priority < msg.topicPriority) {
            forks.priority = msg.topicPriority
            forks.name = msg.topic
            forks.msg = utils.clone(msg)
            if (forks.node) {
              const n = forks.node
              forks.node = node
              n.end(null, msg)
            } else {
              forks.node = node
            }
            freeze = true
          }
          forks.numWire--
          if (forks.numWire <= 0) {
            msg._forks.pop()
            const forkid = msg._forks[msg._forks.length - 1]
            if (typeof forks.msg.topic !== "undefined" && forks.msg.topicPriority !== 0) {
              forks.msg._forks = msg._forks
              if (node.wires.length > 1) {
                forks.node.jump(forks.msg)
              } else {
                forks.node.next(forks.msg)
              }
              if (!freeze) {
                node.end(null, msg)
              }
            } else {
              if (msg.topicPriority === 0) {
                delete msg.topic
              }
              if (node.wires.length > 1) {
                node.jump(msg)
              } else {
                node.next(msg)
              }
            }
            return
          }
        } else {
          //error
        }
      }
      if (!freeze) {
        node.end(null, msg)
      }
    })
  }
  DORA.registerType("join", CoreJoin)

  /*
   *
   *
   */
  function CoreJoinLoop(node, options) {
    node.nextLabel(options)
    node.on("input", function (msg) {
      if (msg._forks && msg._forks.length > 0) {
        node.jump(msg)
      } else {
        node.next(msg)
      }
    })
  }
  DORA.registerType("joinLoop", CoreJoinLoop)
  DORA.registerType("join.loop", CoreJoinLoop)

  /*
   *
   *
   */
  function CorePriority(node, options) {
    node.on("input", function (msg) {
      if (typeof msg.topicPriority === "undefined") {
        msg.topicPriority = 0
      }
      msg.topicPriority = msg.topicPriority + (options === null ? 10 : parseInt(options))
      node.send(msg)
    })
  }
  DORA.registerType("priority", CorePriority)

  /*
   *
   *
   */
  function CoreTopic(node, options) {
    node.on("input", function (msg) {
      msg.topic = options
      msg.topicPriority = typeof msg.topicPriority !== "undefined" ? msg.topicPriority : 0
      node.send(msg)
    })
  }
  DORA.registerType("topic", CoreTopic)

  /*
   *
   *
   */
  function CoreOther(node, options) {
    node.nextLabel(options)
    node.on("input", function (msg) {
      if (msg.topicPriority > 0) {
        node.next(msg)
      } else {
        node.jump(msg)
      }
    })
  }
  DORA.registerType("other", CoreOther)
  /*
   *
   *
   */
  function Sound(type: "sound" | "sound.sync") {
    return function (node: Node, options) {
      const isTemplated = (options || "").indexOf("{{") != -1
      node.on("input", async function (msg) {
        const { socket } = node.flow.options
        let message = options
        if (isTemplated) {
          message = DORA.utils.mustache.render(message, msg)
        }
        await node.flow.request({
          type,
          sound: message,
        })
        node.send(msg)
      })
    }
  }
  DORA.registerType("sound", Sound("sound"))
  DORA.registerType("sound.sync", Sound("sound.sync"))

  /*
   *
   *
   */
  function CoreSet(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    const p = options.split("/")
    const field = p[0].split(".").filter((v) => v !== "")
    if (p.length < 2) {
      throw new Error("パラメータがありません。")
    }
    const value = p.slice(1).join("/")
    node.on("input", async function (msg) {
      let t = msg
      let key = null
      let v = msg
      field.forEach((f) => {
        if (typeof t === "undefined" || typeof t !== "object") {
          v[key] = {}
          t = v[key]
        }
        key = f
        v = t
        t = t[f]
      })
      if (typeof v !== "undefined" && typeof key !== "undefined") {
        const val = (v) => {
          if (utils.isNumeric(v)) {
            if (v.indexOf(".") >= 0) {
              return parseFloat(v)
            } else {
              return parseInt(v)
            }
          }
          if (isTemplated) {
            v = utils.mustache.render(v, msg)
          }
          return v
        }
        v[key] = val(value)
      }
      if (msg.labels) {
        Object.keys(msg.labels).forEach((key) => {
          const v = msg.labels[key]
          this.flow.labels[key] = v
        })
      }
      node.send(msg)
    })
  }
  DORA.registerType("set", CoreSet)

  /*
   *
   *
   */
  function CoreSetString(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    const p = options.split("/")
    const field = p[0].split(".").filter((v) => v !== "")
    if (p.length < 2) {
      throw new Error("パラメータがありません。")
    }
    node.on("input", async function (msg) {
      let t = msg
      let key = null
      let v = msg
      field.forEach((f) => {
        if (typeof t === "undefined" || typeof t !== "object") {
          v[key] = {}
          t = v[key]
        }
        key = f
        v = t
        t = t[f]
      })
      if (typeof v !== "undefined" && typeof key !== "undefined") {
        let message = p.slice(1).join("/")
        if (isTemplated) {
          message = utils.mustache.render(message, msg)
        }
        v[key] = message
      }
      if (msg.labels) {
        Object.keys(msg.labels).forEach((key) => {
          const v = msg.labels[key]
          this.flow.labels[key] = v
        })
      }
      node.send(msg)
    })
  }
  DORA.registerType("set.string", CoreSetString)

  /*
   *
   *
   */
  function CoreSetNumber(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    const p = options.split("/")
    const field = p[0].split(".").filter((v) => v !== "")
    if (p.length < 2) {
      throw new Error("パラメータがありません。")
    }
    node.on("input", async function (msg) {
      let t = msg
      let key = null
      let v = msg
      field.forEach((f) => {
        if (typeof t === "undefined" || typeof t !== "object") {
          v[key] = {}
          t = v[key]
        }
        key = f
        v = t
        t = t[f]
      })
      if (typeof v !== "undefined" && typeof key !== "undefined") {
        const val = (v) => {
          if (utils.isNumeric(v)) {
            if (v.indexOf(".") >= 0) {
              return parseFloat(v)
            } else {
              return parseInt(v)
            }
          }
          node.err(new Error("数字ではありません。"))
        }
        let message = p.slice(1).join("/")
        if (isTemplated) {
          message = utils.mustache.render(message, msg)
        }
        v[key] = val(message)
      }
      if (msg.labels) {
        Object.keys(msg.labels).forEach((key) => {
          const v = msg.labels[key]
          this.flow.labels[key] = v
        })
      }
      node.send(msg)
    })
  }
  DORA.registerType("set.number", CoreSetNumber)

  /*
   *
   *
   */
  function CoreGet(node, options) {
    const p = options.split("/")
    const field = p[0].split(".")
    node.on("input", async function (msg) {
      let t = msg
      field.forEach((f) => {
        if (f !== "") {
          if (typeof t !== "undefined") {
            t = t[f]
          }
        }
      })
      if (typeof t !== "undefined") {
        msg.payload = t
      }
      node.send(msg)
    })
  }
  DORA.registerType("get", CoreGet)

  /*
   *
   *
   */
  function CoreChange(node, options) {
    const params = options.split("/")
    if (params.length < 2) {
      throw new Error("パラメータがありません。")
    }
    const isTemplated1 = (params[0] || "").indexOf("{{") != -1
    const isTemplated2 = (params[1] || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      let p1 = params[0]
      let p2 = params[1]
      if (isTemplated1) {
        p1 = utils.mustache.render(p1, msg)
      }
      if (isTemplated2) {
        p2 = utils.mustache.render(p2, msg)
      }
      if (p1.indexOf(".") == 0) {
        p1 = p1.slice(1)
      }
      if (p2.indexOf(".") == 0) {
        p2 = p2.slice(1)
      }
      const getField = (msg, field) => {
        let val = msg
        let key = null
        field.split(".").forEach((f) => {
          if (key) {
            if (typeof val[key] === "undefined" || typeof val[key] !== "object") {
              val[key] = {}
            }
            val = val[key]
          }
          key = f
        })
        return { val, key }
      }
      const v1 = getField(msg, p1)
      const v2 = getField(msg, p2)
      if (v1 && v2) {
        v1.val[v1.key] = utils.clone(v2.val[v2.key])
      }
      node.send(msg)
    })
  }
  DORA.registerType("change", CoreChange)

  /*
   *
   *
   */
  function TextToSpeech(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      const { socket } = node.flow.options
      var message = options || msg.payload
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      textToSpeech(node, msg, this.credential(), message)
    })
  }
  DORA.registerType("text-to-speech", TextToSpeech)

  /**
   * 発話をキャンセルして、発話文をpayloadにテキストとして追加する
   * silenceしたら、silence.endすること。
   */
  function Silence(type) {
    return function (node, options) {
      node.on("input", async function (msg) {
        if (type === "start") {
          msg.silence = true
          msg.payload = ""
        } else {
          delete msg.silence
        }
        node.send(msg)
      })
    }
  }
  DORA.registerType("silence", Silence("start"))
  DORA.registerType("silence.end", Silence("end"))
  /*
   *
   *
   */
  function SpeechToText(node, options) {
    node.nextLabel(options)
    node.on("input", function (msg) {
      const { socket } = node.flow.options
      const params: {
        timeout: number
        sensitivity: string
        level: string
        languageCode?: string
        alternativeLanguageCodes?: string[]
      } = {
        timeout: 30000,
        sensitivity: "keep",
        level: "keep",
      }
      if (typeof msg.timeout !== "undefined") {
        params.timeout = msg.timeout
      }
      if (typeof msg.sensitivity !== "undefined") {
        params.sensitivity = msg.sensitivity
      }
      if (typeof msg.voice !== "undefined") {
        if (typeof msg.voice.timeout !== "undefined") {
          params.timeout = msg.voice.timeout
        }
        if (typeof msg.voice.sensitivity !== "undefined") {
          params.sensitivity = msg.voice.sensitivity
        }
        if (typeof msg.voice.level !== "undefined") {
          params.level = msg.voice.level
        }
        if (typeof msg.voice.languageCode !== "undefined") {
          params.languageCode = msg.voice.languageCode.split("/")
        }
        if (typeof msg.voice.alternativeLanguageCodes !== "undefined") {
          params.alternativeLanguageCodes = msg.voice.alternativeLanguageCodes.split("/")
        }
      }
      node.recording = true
      socket.emit(
        "speech-to-text",
        {
          ...params,
          ...this.credential(),
        },
        (res) => {
          if (!node.recording) return
          if (!node.isAlive()) return
          node.recording = false
          if (res == "[timeout]") {
            msg.payload = "timeout"
            node.send(msg)
          } else if (res == "[canceled]") {
            msg.payload = "canceled"
            node.send(msg)
          } else if (res == "[error]") {
            msg.payload = "error"
            node.send(msg)
          } else if (res == "[camera]") {
            msg.payload = "camera"
            node.send(msg)
          } else {
            if (res.button) {
              msg.payload = "button"
              msg.button = res
              delete res.button
              node.send(msg)
            } else if (res.gamepad) {
              msg.payload = "gamepad"
              msg.gamepad = res
              delete res.gamepad
              node.send(msg)
            } else if (res.speechRequest) {
              msg.speechRequest = true
              msg.payload = res.payload
              msg.speechText = msg.payload
              msg.topicPriority = 0
              node.next(msg)
            } else if (typeof res === "object") {
              ;(msg.languageCode = res.languageCode), (msg.confidence = res.confidence)
              msg.payload = res.transcript
              msg.speechText = msg.payload
              msg.topicPriority = 0
              delete msg.speechRequest
              node.next(msg)
            } else {
              msg.payload = res
              msg.speechText = msg.payload
              msg.topicPriority = 0
              delete msg.speechRequest
              node.next(msg)
            }
          }
        }
      )
    })
  }
  DORA.registerType("speech-to-text", SpeechToText)

  /*
   *
   *
   */
  function Translate(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      let opts = options
      if (isTemplated) {
        opts = utils.mustache.render(opts, msg)
      }
      let host = "localhost"
      let port = 3090
      if (typeof msg.dora !== "undefined") {
        if (typeof msg.dora.host !== "undefined") {
          host = msg.dora.host
        }
        if (typeof msg.dora.port !== "undefined") {
          port = msg.dora.port
        }
      }
      const body: {
        text: string
        source?: string
        target?: string
      } = {
        text: msg.payload,
      }
      if (opts) {
        opts = opts.split("/")
        if (opts.length > 0) {
          body.source = "ja"
          body.target = opts[0]
          if (opts.length > 1) {
            body.source = opts[0]
            body.target = opts[1]
          }
        }
      }
      const headers = {}
      headers["Content-Type"] = "application/json"
      let response = await fetch(`http://${host}:${port}/google/translate`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
      if (response.ok) {
        const data = await response.json()
        const translation = data.join("")
        msg.translate = {
          translation,
          ...body,
        }
        msg.payload = translation
      }
      node.send(msg)
    })
  }
  DORA.registerType("translate", Translate)

  /*
   *
   *
   */
  function WaitEvent(node, options) {
    node.nextLabel(options)
    node.on("input", function (msg) {
      const { socket } = node.flow.options
      const params: {
        timeout: number
        sensitivity: string
        recording?: boolean
      } = {
        timeout: 0,
        sensitivity: "keep",
      }
      if (typeof msg.waitevent !== "undefined" && typeof msg.waitevent.timeout !== "undefined") {
        params.timeout = msg.waitevent.timeout
      }
      params.recording = false
      node.recording = true
      socket.emit(
        "speech-to-text",
        {
          ...params,
          ...this.credential(),
        },
        (res) => {
          if (!node.recording) return
          if (!node.isAlive()) return
          node.recording = false
          if (res == "[timeout]") {
            msg.payload = "timeout"
            node.send(msg)
          } else if (res == "[canceled]") {
            msg.payload = "canceled"
            node.send(msg)
          } else if (res == "[error]") {
            msg.payload = "error"
            node.send(msg)
          } else if (res == "[camera]") {
            msg.payload = "camera"
            node.send(msg)
          } else {
            if (res.button) {
              msg.payload = "button"
              msg.button = res
              delete res.button
              node.send(msg)
            } else if (res.gamepad) {
              msg.payload = "gamepad"
              msg.gamepad = res
              delete res.gamepad
              node.send(msg)
            } else if (res.speechRequest) {
              msg.speechRequest = true
              msg.payload = res.payload
              msg.speechText = msg.payload
              msg.topicPriority = 0
              node.next(msg)
            } else if (typeof res === "object") {
              ;(msg.languageCode = res.languageCode), (msg.confidence = res.confidence)
              msg.payload = res.transcript
              msg.speechText = msg.payload
              msg.topicPriority = 0
              delete msg.speechRequest
              node.next(msg)
            } else {
              msg.payload = res
              msg.speechText = msg.payload
              msg.topicPriority = 0
              delete msg.speechRequest
              node.next(msg)
            }
          }
        }
      )
    })
  }
  DORA.registerType("wait-event", WaitEvent)

  /*
   *
   *
   */
  function StopSpeech(node, options) {
    node.on("input", function (msg) {
      const { socket } = node.flow.options
      socket.emit(
        "stop-speech",
        {
          ...this.credential(),
        },
        (res) => {
          if (!node.isAlive()) return
          node.next(msg)
        }
      )
    })
  }
  DORA.registerType("stop-speech", StopSpeech)

  /*
   *
   *
   */
  function JoinFlow(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      const { socket } = node.flow.options
      let option = options
      if (isTemplated) {
        option = utils.mustache.render(option, msg)
      }
      socket.emit(
        "stop-speech",
        {
          ...this.credential(),
          option,
        },
        (res) => {
          if (!node.isAlive()) return
          if (node.join("force")) {
            node.next(msg)
          }
        }
      )
    })
  }
  DORA.registerType("join-flow", JoinFlow)

  /*
   *
   *
   */
  function SpeechStop(node: Node, options) {
    node.on("input", function (msg) {
      const { socket } = node.flow.options
      socket.emit(
        "text-to-speech",
        {
          msg,
          params: {
            action: "stop",
            ...this.credential(),
          },
          node,
        },
        (res) => {
          if (!node.isAlive()) return
          node.next(msg)
        }
      )
    })
  }
  DORA.registerType("text-to-speech.stop", SpeechStop)
  DORA.registerType("wait-event.stop", SpeechStop)

  /*
   *  サブタイトルの消去
   *
   */
  function ClearSubtitle(node: Node, options) {
    node.on("input", function (msg) {
      const { socket } = node.flow.options
      socket.emit(
        "clear-subtitle",
        {
          msg,
          node,
        },
        (res) => {
          if (!node.isAlive()) return
          node.next(msg)
        }
      )
    })
  }
  DORA.registerType("clear.subtitle", ClearSubtitle)

  /*
   *
   *
   */
  function CoreSwitch(node, options) {
    const params = options.split("/")
    var string = params[0]
    const isTemplated = (string || "").indexOf("{{") != -1
    if (params.length > 1) {
      node.nextLabel(params.slice(1).join("/"))
    } else {
      node.nextLabel(string)
    }
    node.on("input", function (msg) {
      let message = string
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      if (typeof msg.payload === "undefined") msg.payload = ""
      if (message.trim().toLowerCase() == msg.payload.toString().trim().toLowerCase()) {
        node.jump(msg)
      } else {
        node.next(msg)
      }
    })
  }
  DORA.registerType("switch", CoreSwitch)

  /*
   *
   *
   */
  function CoreCheck(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject()
      let message = options
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      const params = message.split("/")
      const n = []
      msg.topicPriority = typeof msg.topicPriority !== "undefined" ? msg.topicPriority : 0
      params.forEach((message) => {
        msg.topicPriority += utils.nGramCheck(msg.payload, message)
      })
      node.send(msg)
    })
  }
  DORA.registerType("check", CoreCheck)

  /*
   *
   *
   */
  function CorePayload(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      var message = options || msg.payload
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      msg.payload = message
      node.send(msg)
    })
  }
  DORA.registerType("payload", CorePayload)

  /*
   *
   *
   */
  function CoreCall(node, options) {
    node.options = options
    node.on("input", async function (msg) {
      const opt: { range? } = {}
      Object.keys(node.flow.options).forEach((key) => {
        opt[key] = node.flow.options[key]
      })
      opt.range = {
        start: 0,
      }
      const dora = await node.dora()
      dora.play(msg, opt, (err, msg) => {
        if (err) node.err(new Error("再生エラー。"))
        if (!node.isAlive()) return
        node.send(msg)
      })
    })
  }
  DORA.registerType("call", CoreCall)

  /*
   *
   *
   */
  function CoreExec(node, options) {
    node.on("input", function (msg) {
      var script = options
      //eval(script);
      node.send(msg)
    })
  }
  DORA.registerType("exec", CoreExec)

  /*
   *
   *
   */
  function CoreEval(node, options) {
    node.on("input", function (msg) {
      node.flow.engine.eval(node, msg, {}, (err, msg) => {
        node.send(msg)
      })
    })
  }
  DORA.registerType("eval", CoreEval)

  /*
   *
   *
   */
  function QuizSelect(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject()
      let message = options
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      msg.quiz.pages.push({
        action: "quiz",
        question: message,
        choices: [],
        answers: [],
        selects: [],
      })
      node.send(msg)
    })
  }
  DORA.registerType("select", QuizSelect)

  /*
   *
   *
   */
  function QuizSelectLayout(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject()
      let layout = options
      if (isTemplated) {
        layout = utils.mustache.render(layout, msg)
      }
      if (msg.quiz.pages.length > 0) {
        msg.quiz.pages[msg.quiz.pages.length - 1].layout = layout
      }
      node.send(msg)
    })
  }
  DORA.registerType("select.layout", QuizSelectLayout)

  /**
   *
   *
   */
  function QuizOptionCategory(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      QuizCategory(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("category", QuizOptionCategory)

  /*
   *
   *
   */
  function QuizOptionOK(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      QuizOK(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("ok", QuizOptionOK)

  /*
   *
   *
   */
  function QuizOptionOKImage(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      QuizOKImage(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("ok.image", QuizOptionOKImage)

  /*
   *
   *
   */
  function QuizOptionNG(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      QuizNG(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("ng", QuizOptionNG)

  /*
   *
   *
   */
  function QuizOptionNGImage(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", function (msg) {
      QuizNGImage(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("ng.image", QuizOptionNGImage)

  /*
   *
   *
   */
  function Run(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      if (!node.isAlive()) return
      let nextscript = options || msg.payload
      if (isTemplated) {
        nextscript = utils.mustache.render(nextscript, msg)
      }
      nextscript = nextscript.trim()
      if (nextscript.indexOf("http") == 0) {
        const res = await node.flow.request({
          type: "scenario",
          action: "load",
          uri: nextscript,
          username: msg.username,
        })
        msg._nextscript = res.next_script
      } else {
        msg._nextscript = nextscript
      }
      node.end(null, msg)
    })
  }
  DORA.registerType("run", Run)

  /*
   * 値を変換する
   *
   */
  function Convert(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      let message = options || msg.payload
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      if (typeof message !== "undefined") {
        let p = message.toString().split("/")
        let command = p.shift()
        message = p.join("/")
        if (command === "encodeURIComponent") {
          msg.payload = encodeURIComponent(message)
        }
        if (command === "decodeURIComponent") {
          msg.payload = decodeURIComponent(message)
        }
      }
      node.next(msg)
    })
  }
  DORA.registerType("convert", Convert)

  /*
   * 電源を切る
   *
   */
  function PowerOff(node, options) {
    node.on("input", async function (msg) {
      await node.flow.request({
        type: "poweroff",
      })
      node.next(msg)
    })
  }
  DORA.registerType("poweroff", PowerOff)

  /*
   * 再起動
   *
   */
  function Reboot(node, options) {
    node.on("input", async function (msg) {
      await node.flow.request({
        type: "reboot",
      })
      node.next(msg)
    })
  }
  DORA.registerType("reboot", Reboot)

  /*
   * 設定値のセーブ
   *
   */
  function Save(node, options) {
    const p = options ? options.split("/") : []
    let field = p.length > 0 ? p[0].split(".") : []
    if (p.length < 1) {
      field = ["defaults"]
    }
    node.on("input", async function (msg) {
      let t = msg
      field.forEach((f) => {
        if (f !== "") {
          if (typeof t !== "undefined") {
            t = t[f]
          }
        }
      })
      if (typeof t !== "undefined") {
        await node.flow.request({
          type: "save",
          action: "defaults",
          data: t,
        })
      }
      node.next(msg)
    })
  }
  DORA.registerType("save", Save)

  /*
   * 設定値のロード
   *
   */
  function Load(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    const p = options ? options.split("/") : []
    let field = p.length > 0 ? p[0].split(".").filter((v) => v !== "") : []
    if (p.length < 1) {
      field = ["defaults"]
    }
    node.on("input", async function (msg) {
      const response = await node.flow.request({
        type: "load",
        action: "defaults",
      })
      let t = msg
      let key = null
      let v = msg
      field.forEach((f) => {
        if (typeof t === "undefined" || typeof t !== "object") {
          v[key] = {}
          t = v[key]
        }
        key = f
        v = t
        t = t[f]
      })
      if (typeof v !== "undefined" && typeof key !== "undefined") {
        v[key] = response.data
      }
      if (msg.labels) {
        Object.keys(msg.labels).forEach((key) => {
          const v = msg.labels[key]
          this.flow.labels[key] = v
        })
      }
      node.next(msg)
    })
  }
  DORA.registerType("load", Load)

  /**
   *
   *
   */
  function QuizSlideFunc(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      await QuizSlide(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("slide", QuizSlideFunc)

  /**
   *
   *
   */
  function CommmandFunc(node: Node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      const { socket } = node.flow.options
      let command = options || msg.payload
      if (isTemplated) {
        command = utils.mustache.render(command, msg)
      }
      if (typeof command !== "undefined") {
        socket.emit(
          "command",
          {
            command,
            ...this.credential(),
          },
          (res) => {
            if (!node.isAlive()) return
            node.next(msg)
          }
        )
      } else {
        node.next(msg)
      }
    })
  }
  DORA.registerType("command", CommmandFunc)

  /*
   * 音声認識のタイムアウト値(秒)を指定する
   * /timeout/3
   */
  function Timeout(node: Node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      const val = (v) => {
        if (utils.isNumeric(v)) {
          if (v.indexOf(".") >= 0) {
            return parseFloat(v)
          } else {
            return parseInt(v)
          }
        }
        node.err(new Error("タイムアウトの値が数字ではありません。"))
      }
      let message = options
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      msg.timeout = val(message)
      node.next(msg)
    })
  }
  DORA.registerType("timeout", Timeout)

  /*
   * 画像表示
   * /image/"http://localhost:3000/img/picture.png"
   * /image/"img/picture.png"
   */
  function Image(node: Node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      const { socket, host } = node.flow.options
      let message = options
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      if (![/^http.+/, /^:.+/, /^\/\/.+/].some((re) => message.match(re))) {
        message = `image/${message}`
      }
      socket.emit(
        "display/image",
        {
          msg,
          params: {
            image: {
              src: message,
            },
            ...this.credential(),
          },
          node,
        },
        (res) => {}
      )
      node.next(msg)
    })
  }
  DORA.registerType("image", Image)

  /*
   *  /loop/.counter/:LOOP
   *  カウンタが0になるまでLOOPへ
   */
  function Loop(node: Node, options) {
    const params = options.split("/")
    const field = params[0].split(".").filter((v) => v !== "")
    if (params.length > 1) {
      node.nextLabel(params.slice(1).join("/"))
    }
    node.on("input", async function (msg) {
      const result = node.getField(msg, field)
      if (result !== null) {
        const { object, key } = result
        object[key] = parseInt(object[key]) - 1
        if (object[key] > 0) {
          node.jump(msg)
          return
        }
      }
      node.next(msg)
    })
  }
  DORA.registerType("loop", Loop)

  /*
   *  /add/.payload
   *  /add/.payload/10
   *  加算する
   */
  function OpAdd(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    const params = options.split("/")
    if (params.length > 0 && params[0][0] !== ".") {
      throw new Error("パラメータがありません。")
    }
    node.on("input", async function (msg) {
      Add(node, msg, options, isTemplated, 1)
      node.next(msg)
    })
  }
  DORA.registerType("add", OpAdd)

  /*
   *  /sub/.payload
   *  /sub/.payload/10
   *  減算する
   */
  function OpSub(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    const params = options.split("/")
    if (params.length > 0 && params[0][0] !== ".") {
      throw new Error("パラメータがありません。")
    }
    node.on("input", async function (msg) {
      Add(node, msg, options, isTemplated, -1)
      node.next(msg)
    })
  }
  DORA.registerType("sub", OpSub)
}
