const utils = require("../libs/utils")

export function Chat(DORA, config = {}) {
  /*
   *
   *
   */
  function Ask(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      const { socket } = node.flow.options
      let option = options
      if (isTemplated) {
        option = utils.mustache.render(option, msg)
      }
      // チャットに問い合わせ
      socket.emit(
        "chat.ask",
        {
          text: option,
          ...this.credential(),
        },
        (res) => {
          if (!node.isAlive()) return
          node.next(msg)
        }
      )
    })
  }
  DORA.registerType("ask", Ask)

  /*
   *
   *
   */
  function Get(node, options) {
    const isTemplated = (options || "").indexOf("{{") != -1
    node.on("input", async function (msg) {
      const { socket } = node.flow.options
      let option = options
      if (isTemplated) {
        option = utils.mustache.render(option, msg)
      }
      // チャットに問い合わせ
      socket.emit(
        "chat.get",
        {
          text: option,
          ...this.credential(),
        },
        (res) => {
          if (!node.isAlive()) return
          msg.payload = res.text
          node.next(msg)
        }
      )
    })
  }
  DORA.registerType("get", Get)
}
