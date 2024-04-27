import { Log } from "~/logger"

const _selectEngine = (mode: string) => {
  if (mode === "browser") {
    return require("./speech-to-text-browser")
  } else if (mode === "stream") {
    return require("./speech-to-text-stream")
  }
  return require("./speech-to-text-disabled")
}

export const selectEngine = (mode: string) => {
  return _selectEngine(mode).default()
}

////////////////////////////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////////////////////////////

function main() {
  const speech = selectEngine("reazon").default
  Log.info(speech)
}

if (require.main === module) {
  main()
}
