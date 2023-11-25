const utils = require("../libs/utils")
const Buffer = require("buffer").Buffer

function ToNumber(v) {
  if (typeof v === "string") {
    if (v.indexOf(".") >= 0) {
      v = parseFloat(v)
    } else {
      v = parseInt(v)
    }
  }
  return v
}

function GetOption(options, isTemplated, msg) {
  let message = options
  if (isTemplated) {
    message = utils.mustache.render(message, msg)
  }
  return message
}

function Add(node, msg, options, isTemplated) {
  const value = ToNumber(GetOption(options, isTemplated, msg))
  msg.payload = ToNumber(msg.payload)
  msg.payload += value
  node.send(msg)
}

function Sub(node, msg, options, isTemplated) {
  const value = ToNumber(GetOption(options, isTemplated, msg))
  msg.payload = ToNumber(msg.payload)
  msg.payload -= value
  node.send(msg)
}

function Mul(node, msg, options, isTemplated) {
  const value = ToNumber(GetOption(options, isTemplated, msg))
  msg.payload = ToNumber(msg.payload)
  msg.payload *= value
  node.send(msg)
}

function Div(node, msg, options, isTemplated) {
  const value = ToNumber(GetOption(options, isTemplated, msg))
  msg.payload = ToNumber(msg.payload)
  msg.payload /= value
  node.send(msg)
}

function Inc(node, msg, options, isTemplated) {
  const value = GetOption(options, isTemplated, msg)
  if (value) {
    msg.payload = ToNumber(value)
  } else {
    msg.payload = ToNumber(msg.payload)
  }
  msg.payload++
  node.send(msg)
}

function Dec(node, msg, options, isTemplated) {
  const value = GetOption(options, isTemplated, msg)
  if (value) {
    msg.payload = ToNumber(value)
  } else {
    msg.payload = ToNumber(msg.payload)
  }
  msg.payload--
  node.send(msg)
}

function LogicOp(node, msg, options, isTemplated, func) {
  let a = msg.payload
  let b = GetOption(options, isTemplated, msg)
  if (typeof a === "undefined" || typeof b === "undefined") {
    node.err(new Error("operation error"))
    return
  }
  a = Buffer.from(a.toString(), "hex")
  b = Buffer.from(b.toString(), "hex")
  for (var i = 0; i < a.length && i < b.length; i++) {
    const at = a.readUInt8(i)
    const bt = b.readUInt8(i)
    a.writeUInt8(func(at, bt) & 0xff, i)
  }
  msg.payload = a.toString("hex").toUpperCase()
  node.send(msg)
}

function And(node, msg, options, isTemplated) {
  LogicOp(node, msg, options, isTemplated, (a, b) => a & b)
}

function Or(node, msg, options, isTemplated) {
  LogicOp(node, msg, options, isTemplated, (a, b) => a | b)
}

function XOr(node, msg, options, isTemplated) {
  LogicOp(node, msg, options, isTemplated, (a, b) => a ^ b)
}

function Not(node, msg, options, isTemplated) {
  let a = msg.payload
  if (typeof a === "undefined") {
    node.err(new Error("operation error"))
    return
  }
  a = Buffer.from(a.toString(), "hex")
  for (var i = 0; i < a.length; i++) {
    a.writeUInt8(~a.readUInt8(i) & 0xff, i)
  }
  msg.payload = a.toString("hex").toUpperCase()
  node.send(msg)
}

function Int(node, msg, options, isTemplated) {
  const value = GetOption(options, isTemplated, msg)
  if (value) {
    msg.payload = parseInt(value)
  } else {
    msg.payload = parseInt(msg.payload)
  }
  node.send(msg)
}

function Float(node, msg, options, isTemplated) {
  const value = GetOption(options, isTemplated, msg)
  if (value) {
    msg.payload = parseFloat(value)
  } else {
    msg.payload = parseFloat(msg.payload)
  }
  node.send(msg)
}

function Cmp(node, msg, options, isTemplated, ope) {
  const value = ToNumber(GetOption(options, isTemplated, msg))
  msg.payload = ToNumber(msg.payload)
  if (ope(msg.payload, value)) {
    node.send(msg)
  } else {
    node.next(msg)
  }
}

export function Operation(DORA, config = {}) {
  /*
   *
   *
   */
  function OpAdd(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      Add(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("add", OpAdd)

  /*
   *
   *
   */
  function OpSub(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      Sub(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("sub", OpSub)

  /*
   *
   *
   */
  function OpMul(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      Mul(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("mul", OpMul)

  /*
   *
   *
   */
  function OpDiv(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      Div(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("div", OpDiv)

  /*
   *
   *
   */
  function OpInc(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      Inc(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("inc", OpInc)

  /*
   *
   *
   */
  function OpDec(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      Dec(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("dec", OpDec)

  /*
   *
   *
   */
  function OpAnd(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      And(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("and", OpAnd)

  /*
   *
   *
   */
  function OpOr(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      Or(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("or", OpOr)

  /*
   *
   *
   */
  function OpXOr(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      XOr(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("xor", OpXOr)

  /*
   *
   *
   */
  function OpNot(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      Not(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("not", OpNot)

  /*
   *
   *
   */
  function OpInt(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      Int(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("toInt", OpInt)

  /*
   *
   *
   */
  function OpFloat(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      Float(node, msg, options, isTemplated)
    })
  }
  DORA.registerType("toFloat", OpFloat)

  /*
   *
   *
   */
  function OpCmp(ope) {
    return function (node, options) {
      var isTemplated = (options || "").indexOf("{{") != -1
      node.nextLabel(options, 1)
      node.on("input", async function (msg) {
        const v = options.split("/")
        Cmp(node, msg, v[0], isTemplated, ope)
      })
    }
  }
  DORA.registerType(
    "==",
    OpCmp((a, b) => {
      return a == b
    })
  )
  DORA.registerType(
    "!=",
    OpCmp((a, b) => {
      return a != b
    })
  )
  DORA.registerType(
    ">=",
    OpCmp((a, b) => {
      return a >= b
    })
  )
  DORA.registerType(
    "<=",
    OpCmp((a, b) => {
      return a <= b
    })
  )
  DORA.registerType(
    ">",
    OpCmp((a, b) => {
      return a > b
    })
  )
  DORA.registerType(
    "<",
    OpCmp((a, b) => {
      return a < b
    })
  )
}
