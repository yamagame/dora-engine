import * as fs from "fs"
import { RobotDB as RobotDBSQlite } from "./robot-db-sqlite"
import { RobotDB as RobotDBDummy } from "./robot-db-dummy"

export function RobotDB({ USE_DB, HOME }: { USE_DB: boolean; HOME: string }, callback: () => void) {
  if (USE_DB) {
    return RobotDBSQlite(
      `${HOME}/robot-server.db`,
      {
        operatorsAliases: false,
      },
      async (err, db) => {
        if (callback) callback()
      }
    )
  } else {
    return RobotDBDummy(async (err, db) => {
      if (callback) callback()
    })
  }
}

type RobotDataType = {
  quizAnswers?: any
  quizEntry?: any
  quizPayload?: { [index: string]: any }
  quizList?: any
  recordingTime?: string
  voice?: { level: number; threshold: number }
  autoStart?: any
  chatRecvTime?: Date
}

export class RobotData {
  robotData: RobotDataType = {
    quizAnswers: {},
    quizEntry: {},
    quizPayload: {},
    quizList: {},
    voice: { level: 100, threshold: 2000 },
    autoStart: {},
  }
  saveDelay = false
  savedData = null
  saveWFlag = false

  set recordingTime(recordingTime) {
    this.robotData.recordingTime = recordingTime
  }

  get recordingTime() {
    return this.robotData.recordingTime
  }

  set voice(voice) {
    this.robotData.voice = voice
  }

  get voice() {
    return this.robotData.voice
  }

  set quizEntry(quizEntry) {
    this.robotData.quizEntry = quizEntry
  }

  get quizEntry() {
    return this.robotData.quizEntry
  }

  set quizList(quizList) {
    this.robotData.quizList = quizList
  }

  get quizList() {
    return this.robotData.quizList
  }

  set quizAnswers(quizAnswers) {
    this.robotData.quizAnswers = quizAnswers
  }

  get quizAnswers() {
    return this.robotData.quizAnswers
  }

  set quizPayload(quizPayload) {
    this.robotData.quizPayload = quizPayload
  }

  get quizPayload() {
    return this.robotData.quizPayload
  }

  set autoStart(autoStart) {
    this.robotData.autoStart = autoStart
  }

  get autoStart() {
    return this.robotData.autoStart
  }

  load(robotDataPath: string) {
    let data: RobotDataType = {}
    try {
      const robotJson = fs.readFileSync(robotDataPath, "utf8")
      data = JSON.parse(robotJson)
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.log(err)
        return false
      }
      console.log(`no such file or directory, open '${robotDataPath}'`)
    }
    Object.keys(data).forEach((key) => {
      this.robotData[key] = data[key]
    })
    return true
  }

  save(robotDataPath: string, saveInterval = 1000) {
    this.saveWFlag = true
    if (!this.saveDelay) {
      const save = () => {
        if (this.saveWFlag) {
          this.saveWFlag = false
          this.saveDelay = true
          const data = JSON.stringify(this.robotData, null, "  ")
          if (this.savedData == null || this.savedData !== data) {
            this.savedData = data
            try {
              console.log(`write ${robotDataPath}`)
              fs.writeFile(robotDataPath, data, () => {
                setTimeout(() => {
                  save()
                }, saveInterval)
              })
              return
            } catch (err) {
              console.error(err)
            }
          }
        }
        this.saveDelay = false
      }
      save()
    }
  }
}
