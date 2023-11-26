const clone = require("clone")

const timeout = (ms) => new Promise((res) => setTimeout(res, ms))

const generateId = () => (1 + Math.random() * 4294967295).toString(16)

var mustache = require("mustache")

const _isNumeric = /^[-+]?[123456789](\d*|\d*\.\d*|\d*\.\d+)$/

const isNumeric = function (v) {
  return _isNumeric.test(v) || v === "0"
}

const randInteger = function (min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}

const quizObject = function (quiz = {}) {
  return {
    timeLimit: 60,
    timer: 0,
    pages: [],
    ...quiz,
  }
}

const nGramCheck = function (str1, str2) {
  try {
    const s1 = str1
      .trim()
      .split(" ")
      .filter((v) => v != "")
    const s2 = str2
      .trim()
      .split(" ")
      .filter((v) => v != "")
    if (s1 === s2) return 9999
    let n1 = 0
    let n2 = 0
    let n3 = 0
    s1.forEach((a, i) => {
      s2.forEach((b, j) => {
        if (s1[i + 0] === s2[j + 0]) {
          n1++
          if (s1.length > i + 1 && s2.length > j + 1) {
            if (s1[i + 1] === s2[j + 1]) {
              n2++
              if (s1.length > i + 2 && s2.length > j + 2) {
                if (s1[i + 2] === s2[j + 2]) {
                  n3++
                }
              }
            }
          }
        }
      })
    })
    s2.forEach((a, i) => {
      s1.forEach((b, j) => {
        if (s1[i + 0] === s2[j + 0]) {
          n1++
          if (s1.length > i + 1 && s2.length > j + 1) {
            if (s1[i + 1] === s2[j + 1]) {
              n2++
              if (s1.length > i + 2 && s2.length > j + 2) {
                if (s1[i + 2] === s2[j + 2]) {
                  n3++
                }
              }
            }
          }
        }
      })
    })
    if (str1.indexOf(str2) >= 0) n1++
    if (str2.indexOf(str1) >= 0) n1++
    return n1 + n2 + n3
  } catch (err) {}
  return 0
}

const _clone = (obj) => {
  if (typeof obj === "undefined" || obj === null) return null
  if (typeof obj === "string") return obj
  const callstack = obj.callstack
  delete obj.callstack
  if (obj.quiz && obj.quiz.startTime) {
    delete obj.quiz.startTime.request
  }
  const ret = clone(obj)
  obj.callstack = callstack
  if (callstack) {
    ret.callstack = [...callstack]
  }
  return ret
}

function getParam(param, key, def) {
  if (param && key in param) {
    return param[key]
  }
  return def
}

function logMessage(node, socket, message) {
  socket.emit("dora-event", {
    action: "log",
    message,
    lineNumber: node.index + 1,
    filename: node.flow.filename,
    ...node.credential(),
  })
}

function match(msg, message) {
  return msg.payload.toString().toLowerCase().indexOf(message.trim().toLowerCase()) >= 0
}

export {
  timeout,
  generateId,
  mustache,
  isNumeric,
  randInteger,
  quizObject,
  nGramCheck,
  _clone as clone,
  getParam,
  logMessage,
  match,
}

if (require.main === module) {
  //
}
