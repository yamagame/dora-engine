const EventEmitter = require("events");

const selectEngine = () => {
  if (process.env["SPEECH"] === "whisper") {
    return require("./speech-to-text-whisper")
  } else if (process.env["SPEECH"] === "off") {
    return require("./speech-to-text-disabled")
  }
  return require("./speech-to-text-google")
}

module.exports = selectEngine();
