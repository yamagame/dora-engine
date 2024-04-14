const { spawn } = require("node:child_process")

const pat1 = /> (.+)/
const pat2 = /(.+):(.+)/

function parseline(s: string) {
  const found = s.match(pat1)
  if (found) {
    const next = found[1].match(pat2)
    if (next) {
      const cmd = next[1].trim()
      const val = next[2].trim()
      return { cmd, val }
    } else {
      const cmd = found[1].trim()
      return { cmd }
    }
  }
  return {}
}

function deltrail(s: string) {
  if (s.slice(-1) === "。") {
    return s.slice(0, -1)
  }
  return s
}

function main() {
  const PORT = 3389
  const app = require("http").createServer(handler)
  const io = require("socket.io")(app)

  function handler(req, res) {}

  app.listen(PORT, () => {
    console.log(`listening on port ${PORT}!`)
  })

  io.on("connection", function (socket) {
    console.log("connected", socket.id, socket.handshake.address)
    socket.on("disconnect", function () {
      console.log("disconnect")
    })
  })

  const sub = spawn("./asr/start-asr.sh")

  sub.stdout.on("data", (data) => {
    const lines = data.toString().split("\n")
    lines.forEach((line) => {
      if (line) {
        const { cmd, val } = parseline(line)
        if (cmd) {
          console.log(cmd, val ? val : "", ":")
          if (cmd == "認識結果") {
            if (val.indexOf("<sos/eos>") < 0) {
              io.emit("utterance", { text: deltrail(val) })
            }
          }
        }
      }
    })
  })

  sub.stderr.on("data", (data) => {
    // console.error(`stderr: ${data}`)
  })

  sub.on("close", (code) => {
    console.log(`child process exited with code ${code}`)
  })
}

if (require.main === module) {
  main()
}
