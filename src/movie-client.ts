import * as EventEmitter from "events"
import * as path from "path"
import * as fs from "fs"

import { config } from "./config"

const io = require("socket.io-client")
const player = require("./movie-player")
const ping = require("ping")
const mkdirp = require("mkdirp")

const { basedir } = config

const workFolder = "DoraEngine" //for macOS(development)
const PICT =
  process.platform === "darwin"
    ? path.join(process.env.HOME, "Pictures", workFolder)
    : path.join(process.env.HOME, "Pictures")
const MOVIE =
  process.platform === "darwin"
    ? path.join(process.env.HOME, "Movies", workFolder)
    : path.join(process.env.HOME, "Videos")
const PORT = process.argv[3] || config.serverPort

//true にすると画像サーバーとして機能する
//同じPCで dora-engine が稼働しているときは false にする
const imageServer = false

const express = require("express")
const bodyParser = require("body-parser")
const request = require("request-promise")

const host = process.argv[2] || "localhost"

function MovieClient(host, callback) {
  let t = new EventEmitter()

  const login = async (callback) => {
    try {
      const body = await request({
        uri: `http://${host}:${config.port}/login-guest-client`,
        method: "POST",
        json: {
          username: "guest-client",
          password: process.env.ROBOT_GUEST_CLIENT_ACCESS_KEY || "guestclientnopass",
        },
      })
      callback(null, body)
    } catch (err) {
      callback(err, null)
    }
  }
  login((err, payload) => {
    if (err) {
      callback(err, null)
      return
    }
    const socket = io(`http://${host}:${config.port}/player`)
    socket.on("connect", function () {
      console.log("connect", socket.id)
      if (imageServer) {
        socket.emit("notify", {
          role: "imageServer",
          port: PORT,
          protocol: "http",
          ...payload,
        })
      }
    })
    socket.on("movie", function (data, callback) {
      if (data.action === "play") {
        const p = path.join(MOVIE, data.movie)
        fs.stat(p, (err, stats) => {
          if (!err && stats.isFile()) {
            player.play(p)
          } else {
            const q = path.join(basedir, "../Movie", data.movie)
            fs.stat(q, (err, stats) => {
              if (!err && stats.isFile()) {
                player.play(q)
              } else {
                console.error(`file not exist ${data.movie}`)
              }
            })
          }
        })
      } else if (data.action === "check") {
        if (callback) callback({ state: player.state })
        return
      } else if (data.action === "cancel") {
        player.emit("cancel")
      }
      if (callback) callback({ state: player.state })
    })
    socket.on("disconnect", function () {
      console.log("disconnected")
    })
    player.on("done", function () {
      socket.emit("done")
    })
  })

  return t
}

if (imageServer) {
  const app = express()

  app.use((req, res, next) => {
    console.log(`# ${new Date().toLocaleString()} ${req.ip} ${req.url}`)
    next()
  })

  app.use(bodyParser.json({ type: "application/json" }))
  app.use(bodyParser.raw({ type: "application/*" }))

  app.use("/images", express.static(PICT))

  const server = require("http").Server(app)

  server.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`))
}

module.exports = MovieClient

function ipResolver(host, callback) {
  function _resolve() {
    ping.promise.probe(host).then(function (res) {
      if (res.alive) {
        callback(res)
      } else {
        setTimeout(() => {
          _resolve()
        }, 1000)
      }
    })
  }
  _resolve()
}

if (require.main === module) {
  ipResolver(host, (res) => {
    console.log(`start movie clinet ${res.numeric_host}`)
    const t = MovieClient(host, (err) => {
      if (err) console.error(`${err.name}: ${err.statusCode} - ${err.error}`)
    })
  })
}
