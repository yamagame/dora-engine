export const selectEngine = (mode: string) => {
  if (mode === "whisper") {
    return require("./speech-to-text-whisper")
  } else if (mode === "reazon") {
    return require("./speech-to-text-reazon")
  } else if (mode === "off") {
    return require("./speech-to-text-disabled")
  }
  return require("./speech-to-text-google")
}

////////////////////////////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////////////////////////////

function main() {
  const speech = selectEngine("reazon")
  console.log(speech)
}

if (require.main === module) {
  main()
}
