/* 
//ボタンシナリオのサンプル

/button.open/192.168.2.3:3090/button1
/button.open/192.168.2.4:3090/button2
/button.led-all-blink

/wait-event
/button.led-all-on
/sound.sync/Pop.wav

/wait-event
/button.led-on
/sound.sync/Pop.wav

/wait-event
/button.led-off
/button.sound/Pop.wav
/sound.sync/Pop.wav

/wait-event
/button.led-all-off
/sound.sync/Pop.wav

/wait-event
/sound.sync/Pop.wav
*/

export function ButtonModule(buttonClient) {
  return function (DORA, config) {
    function open(node, options) {
      const params = options.split("/")
      if (params.length < 1 || params === "") {
        throw new Error("ホスト名がありません。")
      }
      node.on("input", async function (msg) {
        let host = params[0]
        let port = null
        if (host.indexOf(":") > 0) {
          const h = host.split(":")
          host = h[0]
          port = h[1]
        }
        const name = params.length > 1 ? params[1] : null
        const team = params.length > 2 ? params[2] : null
        buttonClient.emit("open-slave", { host, name, team, port })
        node.send(msg)
      })
    }
    DORA.registerType("open", open)

    function close(node, options) {
      const params = options.split("/")
      if (params.length < 1 || params === "") {
        throw new Error("ホスト名がありません。")
      }
      node.on("input", async function (msg) {
        const host = params[0]
        buttonClient.emit("close-slave", { host })
        node.send(msg)
      })
    }
    DORA.registerType("close", close)

    function allBlink(node, options) {
      node.on("input", async function (msg) {
        buttonClient.emit("all-blink", {})
        node.send(msg)
      })
    }
    DORA.registerType("led-all-blink", allBlink)

    function allOn(node, options) {
      node.on("input", async function (msg) {
        buttonClient.emit("all-on", {
          bright: 1,
        })
        node.send(msg)
      })
    }
    DORA.registerType("led-all-on", allOn)

    function allOff(node, options) {
      node.on("input", async function (msg) {
        buttonClient.emit("all-off", {})
        node.send(msg)
      })
    }
    DORA.registerType("led-all-off", allOff)

    function ledOn(node, options) {
      node.on("input", async function (msg) {
        if (msg.button) {
          buttonClient.emit("one", {
            name: msg.button.name,
            bright: 1,
          })
        }
        node.send(msg)
      })
    }
    DORA.registerType("led-on", ledOn)

    function ledOff(node, options) {
      node.on("input", async function (msg) {
        if (msg.button) {
          buttonClient.emit("one", {
            name: msg.button.name,
            bright: 0,
          })
        }
        node.send(msg)
      })
    }
    DORA.registerType("led-off", ledOff)

    function sound(node, options) {
      let isTemplated = (options || "").indexOf("{{") != -1
      node.on("input", async function (msg) {
        if (msg.button) {
          const socket = buttonClient.socket(msg.button.name)
          if (socket) {
            let message = options
            if (isTemplated) {
              message = DORA.utils.mustache.render(message, msg)
            }
            socket.emit("sound-command", { sound: message })
          }
        }
        node.send(msg)
      })
    }
    DORA.registerType("sound", sound)

    function soundAll(node, options) {
      let isTemplated = (options || "").indexOf("{{") != -1
      node.on("input", async function (msg) {
        let message = options
        if (isTemplated) {
          message = DORA.utils.mustache.render(message, msg)
        }
        buttonClient.emit("sound", { sound: message })
        node.send(msg)
      })
    }
    DORA.registerType("sound-all", soundAll)

    function speechToText(node, options) {
      node.nextLabel(options)
      node.on("input", async function (msg) {
        if (msg.button) {
          const socket = buttonClient.socket(msg.button.name)
          if (socket) {
            const params = {
              timeout: 30000,
              sensitivity: "keep",
            }
            if (typeof msg.timeout !== "undefined") {
              params.timeout = msg.timeout
            }
            if (typeof msg.sensitivity !== "undefined") {
              params.sensitivity = msg.sensitivity
            }
            node.recording = true
            socket.emit("speech-to-text", params, (res) => {
              if (!node.recording) return
              node.recording = false
              if (res == "[timeout]") {
                msg.payload = "timeout"
                node.send([msg, null])
              } else if (res == "[canceled]") {
                msg.payload = "canceled"
                node.send([msg, null])
              } else if (res == "[error]") {
                msg.payload = "error"
                node.send([msg, null])
              } else {
                if (res.button) {
                  msg.payload = "button"
                  msg.button = res
                  delete res.button
                  node.send([msg, null])
                } else if (res.speechRequest) {
                  msg.speechRequest = true
                  msg.payload = res.payload
                  msg.speechText = msg.payload
                  msg.topicPriority = 0
                  node.send([null, msg])
                } else if (typeof res === "object") {
                  ;(msg.languageCode = res.languageCode),
                    (msg.alternativeLanguageCodes = res.alternativeLanguageCodes),
                    (msg.confidence = res.confidence)
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
                  node.send([null, msg])
                }
              }
            })
          } else {
            msg.payload = "timeout"
            node.send([msg, null])
          }
        } else {
          node.send([msg, null])
        }
      })
    }
    DORA.registerType("speech-to-text", speechToText)
  }
}
