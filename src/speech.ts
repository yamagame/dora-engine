export const selectEngine = (mode: string) => {
  if (mode === "whisper") {
    return require("./speech-to-text-whisper")
  } else if (mode === "off") {
    return require("./speech-to-text-disabled")
  }
  return require("./speech-to-text-google")
}
