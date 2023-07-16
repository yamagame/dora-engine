const nodeFetch = require("node-fetch")
const jsdom = require("jsdom")
const mecab = require("./mecab")
const utils = require("./utils")
const SheetLoader = require("./sheetLoader")
const { JSDOM } = jsdom

const datestr = {
  today: "今日",
  tomorrow: "明日",
  yesterday: "昨日",
}

const dateutter = {
  today: "きょう",
  tomorrow: "明日",
  yesterday: "昨日",
}

const dateoffset = {
  today: 0,
  tomorrow: 1,
  yesterday: -1,
}

const daystr = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"]

function getParam(param, key, def) {
  if (param && key in param) {
    return param[key]
  }
  return def
}

function mecabAsync(str) {
  return new Promise<any>((resolved) => {
    mecab.parse(str, (err, result) => {
      resolved(result)
    })
  })
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max))
}

const getParams = async (sheetLoader, body) => {
  const message = getParam(body, "message", "")
  const sheetName = getParam(body, "sheetName", "")
  const sheetId = getParam(body, "sheetId", "")
  const useMecab = getParam(body, "useMecab", "true") == "true"
  const download = getParam(body, "download", "auto")
  if (sheetName === "") return null
  const sheetData = await sheetLoader.load(sheetId, sheetName, { download, useMecab })
  return {
    message,
    sheetName,
    sheetId,
    sheetData,
  }
}

const randomReplay = async (sheetLoader, req, res) => {
  function randomReplay(sheetData) {
    if (sheetData && sheetData.length > 0) {
      return sheetData[getRandomInt(sheetData.length)]
    }
    return {
      answer: "えっと",
    }
  }

  const p = await getParams(sheetLoader, req.body)
  if (p == null) return notfoundReplay(req, res)

  const replay = randomReplay(p.sheetData)
  res.send({
    answer: replay.answer,
    message: p.message,
  })
}

const notfoundReplay = async (req, res) => {
  const message = getParam(req.body, "message", "")
  res.send({
    answer: "not-found",
    message,
  })
}

const searchAnswer = async (sheetData, message, type = "ngram") => {
  const ask = (await mecabAsync(message)).map((v) => v[0]).join(" ")
  let point = 0
  let target = null
  sheetData.some((v) => {
    if (type === "check") {
      if (v.check) {
        if (message.trim().toLowerCase().indexOf(v.check.trim().toLowerCase()) >= 0) {
          target = { ...v }
          return true
        }
      }
    } else if (v.ask) {
      const p = utils.nGramCheck(v.ask.morpho, ask)
      if (point < p) {
        let ignore = false
        if ("keyword" in v && v.keyword.length > 0) {
          ignore = false
          if (
            v.keyword.some((k) => {
              // console.log(v.ask.org, k);
              return message.indexOf(k) < 0
            })
          ) {
            ignore = true
          }
        }
        //typeがsameの場合は、同じ単語が含まれていなければヒットしない
        if (type === "same") {
          if (message.trim().toLowerCase().indexOf(v.ask.org.trim().toLowerCase()) < 0) {
            ignore = true
          }
        }
        if (ignore) {
          //console.log(`無視 ${ask} ${v.ask.org}`);
        } else {
          point = p
          target = { ...v }
        }
      }
    }
    return false
  })
  if (target) {
    const index = getRandomInt(target.answer.length)
    const answer = target.answer
    delete target.answer
    delete target.message
    const ask = target.ask.org
    delete target.ask
    target.ask = ask
    delete target.weight
    delete target.keyword
    return {
      answer: `${answer[index]}`,
      message,
      point,
      ...target,
    }
  }
  return null
}

const queryJPWikipedia = async (search, retry, callback) => {
  const limitString = (s, n) => {
    let r = ""
    try {
      const t = s.split("。")
      let l = 0
      t.some((v) => {
        l += v.length
        r += v + "。"
        return l >= n
      })
    } catch (err) {}
    return r
  }
  const removeBracket = (s) => {
    return limitString(
      utils
        .removeBracket(s)
        .replace(/(\s+)/g, "")
        .replace(/（.*?）/g, "")
        .replace(/\[.*?\]/g, ""),
      50
    )
  }
  const sorry = `ごめんなさい、${search}はよくわからないんです。`
  const query = `http://ja.wikipedia.org/w/index.php?search=${encodeURIComponent(search)}`
  let response = await nodeFetch(query, {
    method: "GET",
    headers: {
      "User-Agent": "curl/7.54.0",
    },
  })
  if (response.ok) {
    if (response.redirected) {
      return callback(null, response.redirect())
    }
    const data = await response.text()
    const dom = new JSDOM(data)
    try {
      const catlinksContent = dom.window.document.querySelector("div#catlinks").textContent
      if (catlinksContent.indexOf("曖昧さ回避") >= 0) {
        if (retry === "no") {
          const p = "div#mw-content-text > div.mw-parser-output > ul > li > a:last-child"
          const keyword = dom.window.document.querySelector(p).textContent
          return queryJPWikipedia(keyword, "yes", callback)
        } else {
          return callback(new Error("not found"), sorry)
        }
      }
      const bodyContent = dom.window.document.querySelector("div#bodyContent").textContent
      if (bodyContent.indexOf("名前の項目はありません") >= 0) {
        return callback(new Error("not found"), sorry)
      }
      return callback(
        null,
        removeBracket(
          dom.window.document.querySelector("div#mw-content-text > div.mw-parser-output > p")
            .textContent
        )
      )
    } catch (err) {}
    try {
      return callback(
        null,
        removeBracket(
          dom.window.document.querySelector("li.mw-search-result > div.searchresult").textContent
        )
      )
    } catch (err) {}
  }
  if (callback) callback(new Error("not found"), sorry)
}

const getKeyword = async (req, res) => {
  //助詞の前の名詞を取り出す
  const getNoun = (ret, part = null) => {
    let noun = ""
    ret.some((v) => {
      if (part) {
        if (v[1] === "助詞" && v[0] === part) {
          return true
        }
        if (v[1] === "名詞") {
          noun = noun + v[0]
        } else {
          noun = ""
        }
      } else {
        if (v[1] === "名詞") {
          noun = v[0]
          return true
        }
      }
    })
    return noun
  }
  let message = getParam(req.body, "message", "")
  const ret = await mecabAsync(message)
  //助詞「は」の前の名詞を取り出す
  {
    const noun = getNoun(ret, "は")
    if (noun) {
      return {
        keyword: noun,
      }
    }
  }
  //助詞「って」の前の名詞を取り出す
  {
    const noun = getNoun(ret, "って")
    if (noun) {
      return {
        keyword: noun,
      }
    }
  }
  //助詞「を」の前の名詞を取り出す
  {
    const noun = getNoun(ret, "を")
    if (noun) {
      return {
        keyword: noun,
      }
    }
  }
  //最初の名詞を取り出す
  {
    const noun = getNoun(ret)
    if (noun) {
      return {
        keyword: noun,
      }
    }
  }
}

export default function (router, settings) {
  const sheetLoader = new SheetLoader(settings)

  //時間
  router.post(`/time`, (req, res) => {
    const now = new Date()
    const r = {
      answer: `${now.getHours()}時${now.getMinutes()}分です。`,
      message: getParam(req.body, "message", ""),
    }
    res.send(r)
  })

  //日にち
  router.post(`/date`, (req, res) => {
    const date = getParam(req.body, "date", "today")
    const now = new Date()
    const day = new Date(now)
    day.setDate(now.getDate() + dateoffset[date])
    const r = {
      answer: `${dateutter[date]}は${day.getMonth() + 1}月、${day.getDate()}日です。`,
      message: getParam(req.body, "message", ""),
    }
    res.send(r)
  })

  //曜日
  router.post(`/day`, (req, res) => {
    const date = getParam(req.body, "date", "today")
    const now = new Date()
    const day = new Date(now)
    day.setDate(now.getDate() + dateoffset[date])
    const r = {
      answer: `${dateutter[date]}は${daystr[day.getDay()]}日です。`,
      message: getParam(req.body, "message", ""),
    }
    res.send(r)
  })

  if (settings.weather) {
    // curl -G http://localhost:3800/chat/weather --data-urlencode "day=今日"
    // エリアID一覧: http://weather.livedoor.com/forecast/rss/primary_area.xml
    router.post(`/weather`, async (req, res) => {
      const dateLabel = datestr[getParam(req.body, "date", "today")]
      const dateUtter = getParam(req.body, "utter", dateLabel)
      let response = await nodeFetch(
        `http://weather.livedoor.com/forecast/webservice/json/v1?city=${130010}`,
        {
          method: "GET",
        }
      )
      let answer = `ごめんなさい、${dateUtter}の天気はわかりません`
      if (response.ok) {
        const data = await response.json()
        let telop = null
        if (data.forecasts) {
          data.forecasts.some((v) => {
            if (v.dateLabel == dateLabel) {
              telop = v.telop
              return true
            }
            return false
          })
        }
        if (telop) {
          answer = `${dateUtter}の天気は${telop}ですよ`
        }
      }
      const r = {
        answer,
        message: getParam(req.body, "message", ""),
      }
      res.send(r)
    })
  }

  if (settings.wikipedia) {
    //Wikipedia検索
    router.post(`/wikipedia`, async (req, res) => {
      const message = getParam(req.body, "message", "")
      const { keyword } = await getKeyword(req, res)
      if (keyword) {
        queryJPWikipedia(keyword, "no", async (err, message) => {
          if (err) {
            return await notfoundReplay(req, res)
          }
          res.send({
            answer: `「${keyword}」をWikipediaで検索したところ、${message}、だよ`,
            message,
          })
        })
      } else {
        await notfoundReplay(req, res)
      }
    })
  }

  //ダウンロードのみ
  router.post(`/download`, async (req, res) => {
    try {
      const body = {
        ...req.body,
        download: "force",
      }
      const p = await getParams(sheetLoader, body)
      if (p == null) {
        return res.send({
          answer: "not-found",
        })
      }
      res.send({
        answer: "found",
      })
    } catch (err) {
      console.error(err)
      return res.send({
        answer: "error",
        err: err.toString(),
      })
    }
  })

  //ランダムな応答
  router.post(`/random`, async (req, res) => {
    try {
      return await randomReplay(sheetLoader, req, res)
    } catch (err) {
      console.error(err)
    }
    notfoundReplay(req, res)
  })

  //一致する項目を検索
  router.post(`/search`, async function (req, res) {
    try {
      const p = await getParams(sheetLoader, req.body)
      if (p == null) return notfoundReplay(req, res)
      const r = await searchAnswer(p.sheetData, p.message, "same")
      if (r) {
        res.send(r)
        return
      }
    } catch (err) {
      console.error(err)
    }
    notfoundReplay(req, res)
  })

  //一致する項目を検索
  router.post(`/check`, async function (req, res) {
    try {
      const p = await getParams(sheetLoader, req.body)
      if (p == null) return notfoundReplay(req, res)
      const r = await searchAnswer(p.sheetData, p.message, "check")
      if (r) {
        res.send(r)
        return
      }
    } catch (err) {
      console.error(err)
    }
    notfoundReplay(req, res)
  })

  //対話検索
  router.post(`/`, async function (req, res) {
    try {
      const p = await getParams(sheetLoader, req.body)
      if (p == null) return notfoundReplay(req, res)
      const r = await searchAnswer(p.sheetData, p.message)
      if (r) {
        res.send(r)
        return
      }
    } catch (err) {
      console.error(err)
    }
    notfoundReplay(req, res)
  })

  return router
}
