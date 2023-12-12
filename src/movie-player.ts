import * as EventEmitter from "events"
import * as path from "path"
import { spawn } from "child_process"
import { Log } from "~/logger"

import { config } from "./config"

const util = require("./utils")

const { basedir } = config

class PlayerEmitter extends EventEmitter {
  state: string

  constructor() {
    super()
    this.state = "idle"
  }

  play(moviefilepath) {
    let _play = null
    if (process.platform === "darwin") {
      _play = spawn(path.join(basedir, "movie-play-mac.scpt"), [moviefilepath])
    } else {
      _play = spawn("/usr/bin/omxplayer", ["--no-osd", moviefilepath])
    }
    this.state = "play"
    _play.on("close", function (code) {
      this.state = "idle"
      this.removeListener("cancel", cancel)
      this.emit("done")
    })
    function cancel() {
      util.kill(_play.pid, "SIGTERM", function () {})
      this.removeListener("cancel", cancel)
    }
    this.on("cancel", cancel)
  }
}

function Player() {
  return new PlayerEmitter()
}

const player = Player()
export default player

if (require.main === module) {
  player.play(process.argv[2])
  player.on("done", function () {
    Log.info("done")
  })
}
