import * as fs from "fs"
import * as path from "path"
import { ulid } from "ulid"

const logfile = "log.csv"

type MessageType = {
  [index: string]: string | Date | number
}

const empty = { timestamp: "", action: "", wavefile: "", filename: "", text: "" }

function obj2csv(message: MessageType) {
  return Object.keys(message)
    .sort()
    .map((k) => message[k])
    .join(",")
}

export class Logger {
  outdir: string
  count: number = 0
  logfile = "recording-log.csv"
  constructor(props: { outdir: string; logfile?: string }) {
    this.outdir = props.outdir
    if (props.logfile) {
      this.logfile = props.logfile
    }
  }
  log(message: MessageType) {
    console.log(JSON.stringify(message))
    fs.appendFile(
      path.join(this.outdir, logfile),
      `${obj2csv({ ...empty, ...message })}\n`,
      (err) => {
        if (err) throw err
      }
    )
  }
  print(msg: string) {
    process.stdout.clearLine(0)
    process.stdout.write(msg)
    process.stdout.cursorTo(0)
  }
  clearLine() {
    process.stdout.clearLine(0)
  }
  filename() {
    return ulid()
  }
}
