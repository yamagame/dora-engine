import fetch from "node-fetch"
import { Node } from "../../"
const utils = require("../../libs/utils")
const { vegetables, building, structure, hospital, house } = require("./words")
const { TextKan2Num } = require("./kan2num")
const { familyNames } = require("./names")
const { calcHasegawaScore } = require("./score")

const numberString = "０0１1２2３3４4５5６6７7８8９9"

const slotPattern = {
  名前: [
    ...familyNames
      .map((d) => d.slice(1))
      .sort((a, b) => {
        return b[0].length - a[0].length
      }),
  ],
  年: [/(\d+)年/],
  月: [/(\d+)月/],
  日: [/(\d+)日/],
  曜日: [/([日月火水木金土])曜/],
  歳: [/(\d+)/],
  桜: ["桜", "さくら"],
  猫: ["猫", "ねこ", "日光"],
  電車: ["電車"],
  梅: ["ウメ", "梅", "うめ", "船", "ふね"],
  犬: ["犬", "けん"],
  自動車: ["自動車", "優勝者"],
  数字: [/(\d+)/],
  時計: ["時計", "OK", "おけい"],
  くし: ["くし", "福祉", "牛", "節", "寿司", "串", "櫛", "9時", "ムシ"],
  はさみ: ["はさみ", "鋏", "ハサミ", "ささみ", "挟み"],
  タバコ: ["タバコ", "たばこ"],
  ボールペン: ["ボールペン", "ペン"],
  場所: [...building, ...structure, ...hospital, ...house].sort((a, b) => {
    return b.length - a.length
  }),
  野菜: [...vegetables],
}

const convertMatchString = (transcript, re, slot, date: Date) => {
  if (slot === "歳" || slot === "月" || slot === "日") {
    transcript = TextKan2Num(transcript)
  }
  if (Array.isArray(re)) {
    const match = re[0]
    for (let i = 0; i < re.length; i++) {
      const result = convertMatchString(transcript, re[i], slot, date)
      if (result) {
        result.match = match
        return result
      }
    }
    return null
  }
  if (typeof re === "string") {
    const index = transcript.indexOf(re)
    if (index >= 0) {
      return {
        date,
        org: transcript,
        match: re,
        index,
        slot,
      }
    }
    return null
  }
  const match = transcript.match(re)
  if (!match) return null
  return {
    date,
    org: match[0],
    match: match[1],
    index: match.index,
    slot,
  }
}

const prepare = (msg) => {
  if (!msg.nlp) msg.nlp = {}
  if (!msg.nlp.slot) msg.nlp.slot = {}
  if (!msg.nlp.store) msg.nlp.store = {}
  if (!msg.nlp.order) msg.nlp.order = []
}

const getSlot = (msg, options, isTemplated = false) => {
  let slot = ""
  let pattern = []
  try {
    const params = options.split("/")
    const string = params[0]
    let message = string
    if (isTemplated) {
      message = utils.mustache.render(message, msg)
    }
    if (params.length > 1) {
      if (params[1].trim() === "数字") {
        pattern = [...slotPattern["数字"]]
      }
    }
    slot = message
  } catch (err) {
    slot = options
  }
  const numberIndex = Math.floor(numberString.indexOf(slot) / 2)
  if (numberIndex >= 0) {
    pattern = [numberString[numberIndex * 2], numberString[numberIndex * 2 + 1]]
  }
  if (!msg.nlp.slot[slot]) {
    msg.nlp.slot[slot] = []
    msg.nlp.order.push(slot)
  }
  if (slotPattern[slot]) pattern = [...pattern, ...slotPattern[slot]]
  if (pattern.length > 0) {
    let payload = (msg.payload || "").toString()
    const foundMatch = pattern
      .map((re) => {
        const result = convertMatchString(payload, re, slot, msg.timestamp)
        if (result) {
          payload = payload.replace(result.match, new Array(result.match.length).fill("*").join(""))
        }
        return result
      })
      .filter((item) => item != null)
    if (foundMatch.length > 0) {
      msg.nlp.slot[slot] = [...msg.nlp.slot[slot], ...foundMatch]
      msg.match = foundMatch
        .sort((a, b) => a.index - b.index)
        .map((v) => v.match)
        .join(",")
      msg.matchOne = foundMatch[0].match
      msg.slot = foundMatch[0].slot
    }
  }
  return msg
}

export const Nlp = function (DORA, config = {}) {
  /*
   * /nlp.startQuestion
   * 診断開始
   */
  function StartQuestion(node: Node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      prepare(msg)
      node.next(msg)
    })
  }
  DORA.registerType("startQuestion", StartQuestion)

  /*
   * /nlp.endQuestion
   * 診断終了
   */
  function EndQuestion(node: Node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      prepare(msg)
      node.next(msg)
    })
  }
  DORA.registerType("endQuestion", EndQuestion)

  /*
   * /nlp.logger/質問文
   * 診断終了
   */
  function Logger(node: Node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      const { username } = msg
      const { loggerHost } = node.flow.options
      prepare(msg)
      const makeLogData = (message, category) => {
        const data = {
          名前: username,
        } as any
        const m = message.match("(.+)：(.*)")
        if (m) {
          data[m[1]] = m[2]
        }
        if (category) {
          data["観点"] = category
        }
        return {
          時間: new Date(),
          ...data,
        }
      }
      let message = options
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      console.log(`nlp.logger`, message)
      if (loggerHost) {
        const headers = {}
        try {
          headers["Content-Type"] = "application/json"
          const payload = {
            method: "POST",
            headers,
            body: JSON.stringify(options !== null ? makeLogData(message, msg.category) : msg),
            timeout: "httpTimeout" in msg ? msg.httpTimeout : 3000,
          }
          const response = await fetch(`${loggerHost}`, payload)
          if (response.ok) {
          } else {
            if (msg._httpErrorInterrupt && msg._httpErrorInterrupt.length > 0) {
              msg.httpError = {
                status: response.status,
                statusText: response.statusText,
              }
              node.goto(msg, msg._httpErrorInterrupt)
              return
            } else {
              msg.httpError = {
                status: response.status,
                statusText: response.statusText,
              }
            }
          }
        } catch (err) {
          msg.httpError = {
            code: err.code,
            type: err.type,
            errno: err.errno,
            message: err.message,
          }
          if (msg._httpErrorInterrupt && msg._httpErrorInterrupt.length > 0) {
            node.goto(msg, msg._httpErrorInterrupt)
            return
          }
        }
      }
      node.next(msg)
    })
  }
  DORA.registerType("logger", Logger)

  /*
   * /nlp.slot/キーワード
   * キーワードがpayloadに含まれていればスロットに入れる
   */
  function Slot(node: Node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      prepare(msg)
      node.next(getSlot(msg, options, isTemplated))
    })
  }
  DORA.registerType("slot", Slot)

  /*
   * /nlp.exist/キーワード/:FOUND
   * キーワードがスロットに含まれていればFOUNDへ移動
   */
  function Exist(node: Node, options) {
    const params = options.split("/")
    const string = params[0]
    const isTemplated = (string || "").indexOf("{{") != -1
    if (params.length > 1) {
      node.nextLabel(params.slice(1).join("/"))
    }
    node.on("input", async function (msg) {
      prepare(msg)
      let message = string
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      if (msg.nlp.slot[message] && msg.nlp.slot[message].length > 0) {
        node.jump(msg)
        return
      }
      node.next(msg)
    })
  }
  DORA.registerType("exist", Exist)

  /*
   * /nlp.check/ストア名/:NEXT
   * 全てのスロットが埋まっていれば保存してNEXTへ
   */
  function Check(type: "check" | "check.order") {
    return function (node: Node, options) {
      const params = options.split("/")
      const string = params[0]
      const isTemplated = (string || "").indexOf("{{") != -1
      if (params.length > 1) {
        node.nextLabel(params.slice(1).join("/"))
      }
      node.on("input", async function (msg) {
        prepare(msg)
        let message = string
        if (isTemplated) {
          message = utils.mustache.render(message, msg)
        }
        const existWords = []
        Object.keys(msg.nlp.slot)
          .filter((key) => key !== "")
          .forEach((key) => {
            if (msg.nlp.slot[key].length > 0) {
              const lastItem = msg.nlp.slot[key][msg.nlp.slot[key].length - 1]
              const index = (msg.payload || "").indexOf(lastItem.match)
              if (index >= 0) {
                existWords.push({
                  ...lastItem,
                  index,
                  time: new Date(lastItem.date).getTime(),
                })
              }
            }
          })
        const matchFail = () => {
          const speechMatchWord = existWords
            .sort((a, b) => a.index - b.index)
            .map((item) => item.slot)
            .join(",")
          if (speechMatchWord) {
            msg.slot = speechMatchWord
          }
          node.next(msg)
        }
        if (
          Object.keys(msg.nlp.slot)
            .filter((key) => key !== "")
            .some((key) => {
              return msg.nlp.slot[key].length <= 0
            })
        ) {
          matchFail()
          return
        }
        if (type === "check.order") {
          const v = existWords
            .sort((a, b) => {
              const d = a.time - b.time
              if (d === 0) {
                return a.index - b.index
              }
              return d
            })
            .map((item) => item.slot)
            .join("")
          const t = msg.nlp.order.join("")
          if (v.indexOf(t) < 0) {
            matchFail()
            return
          }
        }
        if (params.length > 1) {
          msg.nlp.store[message] = [...(msg.nlp.store[message] || []), msg.nlp.slot]
          msg.nlp.slot = {}
          node.jump(msg)
        } else {
          node.next(msg)
        }
      })
    }
  }
  DORA.registerType("check", Check("check"))
  DORA.registerType("check.order", Check("check.order"))

  /*
   * /nlp.clear.order
   * 順序スロットをクリア
   */
  function ClearOrder(node: Node, options) {
    node.on("input", async function (msg) {
      prepare(msg)
      msg.nlp.order = []
      node.next(msg)
    })
  }
  DORA.registerType("clear.order", ClearOrder)

  /*
   * /nlp.save/ストア名
   * スロットをストアへ保存
   */
  function Save(node: Node, options) {
    const params = options.split("/")
    const string = params[0]
    const isTemplated = (string || "").indexOf("{{") != -1
    if (params.length > 1) {
      node.nextLabel(params.slice(1).join("/"))
    }
    node.on("input", async function (msg) {
      prepare(msg)
      let message = string
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      msg.nlp.store[message] = [...(msg.nlp.store[message] || []), msg.nlp.slot]
      msg.nlp.slot = {}
      node.next(msg)
    })
  }
  DORA.registerType("save", Save)

  /*
   * /nlp.hasegawa.number
   * 数字の逆唱問題の生成
   */
  function HasegwaNumber(node: Node, options) {
    node.on("input", async function (msg) {
      prepare(msg)
      let values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      const n1 = values[utils.randInteger(0, values.length)]
      values = values.filter((v) => !(v >= n1 - 1 && v <= n1 + 1))
      const n2 = values[utils.randInteger(0, values.length)]
      values = values.filter((v) => !(v >= n2 - 1 && v <= n2 + 1))
      const n3 = values[utils.randInteger(0, values.length)]
      values = values.filter((v) => !(v >= n3 - 1 && v <= n3 + 1))
      const n4 = values[utils.randInteger(0, values.length)]
      msg.hasegawa = {
        ...msg.hasegawa,
        n1,
        n2,
        n3,
        n4,
      }
      node.next(msg)
    })
  }
  DORA.registerType("hasegawa.number", HasegwaNumber)

  /*
   * /nlp.hasegawa.keyword
   * 言葉の即時記銘問題の生成
   */
  function HasegwaKeyword(node: Node, options) {
    node.on("input", async function (msg) {
      prepare(msg)
      const n = utils.randInteger(0, 2)
      if (n === 0) {
        msg.hasegawa = {
          ...msg.hasegawa,
          w1: "桜",
          w2: "猫",
          w3: "電車",
        }
      } else {
        msg.hasegawa = {
          ...msg.hasegawa,
          w1: "梅",
          w2: "犬",
          w3: "自動車",
        }
      }
      node.next(msg)
    })
  }
  DORA.registerType("hasegawa.keyword", HasegwaKeyword)

  /*
   * /nlp.hasegawa.score/.payload
   *
   */
  function HasegwaScore(node: Node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    const params = options.split("/")
    if (params.length > 0 && params[0][0] !== ".") {
      throw new Error("パラメータがありません。")
    }
    node.on("input", async function (msg) {
      prepare(msg)

      let message = options
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      const params = message.split("/")
      const field = params[0].split(".").filter((v) => v !== "")
      const result = node.getField(msg, field)
      if (result !== null) {
        const { object, key } = result
        try {
          const { score, result } = calcHasegawaScore(msg)
          object[key] = score
          msg.hasegawa = {
            ...msg.hasegawa,
            result,
          }
        } catch (err) {
          console.error(err)
          object[key] = 0
          msg.hasegawa = {
            ...msg.hasegawa,
            result: {},
          }
        }
      }

      node.next(msg)
    })
  }
  DORA.registerType("hasegawa.score", HasegwaScore)

  /*
   * /nlp.post
   * ロボットの設定を送信
   */
  function Post(node: Node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      const { socket } = node.flow.options
      prepare(msg)
      let message = options
      if (isTemplated) {
        message = utils.mustache.render(message, msg)
      }
      let timeout = setTimeout(() => {
        timeout = null
        msg.payload = "[timeout]"
        node.next(msg)
      }, 3000)
      socket.emit(
        "http-request",
        {
          msg,
          request: {
            method: "post",
            url: message,
            data: { payload: msg.payload },
          },
          node,
        },
        (res) => {
          if (timeout) {
            clearTimeout(timeout)
            timeout = null
            node.next(msg)
          }
        }
      )
    })
  }
  DORA.registerType("post", Post)
}
