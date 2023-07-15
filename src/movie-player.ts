import * as EventEmitter from "events"
const spawn = require("child_process").spawn
const path = require("path")
const util = require("./utils")

const basedir = path.join(__dirname, "..")

class PlayerEmitter extends EventEmitter {
  state: string

  constructor() {
    super()
    this.state = "idle"
  }

  play(moviefilepath) {
    if (process.platform === "darwin") {
      var _play = spawn(path.join(basedir, "movie-play-mac.scpt"), [moviefilepath])
    } else {
      var _play = spawn("/usr/bin/omxplayer", ["--no-osd", moviefilepath])
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
  var t = new PlayerEmitter()

  return t
}

const player = Player()
module.exports = player

if (require.main === module) {
  player.play(process.argv[2])
  player.on("done", function () {
    console.log("done")
  })
}
