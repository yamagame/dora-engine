import * as fs from "fs"
import * as path from "path"
import { ulid } from "ulid"
import pino from "pino"

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

export class CSVRecordingLogger {
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
    Log.info(JSON.stringify(message))
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

export class Logger {
  logger = pino({ level: process.env.LOG_LEVEL || "info" })
  constructor() {}

  args(msg, ...payload) {
    if (payload.length > 0) {
      return [{ payload }, msg]
    }
    return [msg]
  }

  info(msg, ...payload) {
    const args = this.args(msg, ...payload)
    this.logger.info(args[0], args[1])
  }

  warn(msg, ...payload) {
    const args = this.args(msg, ...payload)
    this.logger.warn(args[0], args[1])
  }

  error(msg, ...payload) {
    const args = this.args(msg, ...payload)
    this.logger.error(args[0], args[1])
  }
}

export const Log = new Logger()
