import * as fs from "fs"
import * as path from "path"
import { sampleToWavAudio, audioSettings } from "./genwav"
import * as process from "node:process"

export { sampleToWavAudio, audioSettings }

function main() {
  const rawfile = process.argv[2]
  const p = path.parse(rawfile)
  const outfile = process.argv[3] || path.join(p.dir, `${p.name}.wav`)
  const rawbinary = fs.readFileSync(rawfile)
  const bytes = new Uint8Array(rawbinary)
  const wavefile = sampleToWavAudio(
    new Int16Array(bytes.buffer),
    new audioSettings(
      {
        sampleSize: 16,
        sampleRate: 48000,
        channelCount: 1,
      },
      false
    )
  )
  fs.writeFileSync(outfile, wavefile)
}

if (require.main === module) {
  main()
}
