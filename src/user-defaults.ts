import * as fs from "fs"
import { Log } from "~/logger"

class UserDefaults {
  defaults: any

  constructor() {
    this.defaults = null
  }

  save(filepath, defaults, callback) {
    if (filepath) {
      if (this.defaults !== null) {
        try {
          if (typeof defaults !== "object") {
            this.defaults = defaults
          } else {
            Object.keys(defaults).forEach((key) => {
              this.defaults[key] = defaults[key]
            })
          }
        } catch (err) {
          // Log.info(err);
          this.defaults = defaults
        }
      } else {
        this.defaults = defaults
      }
      const data = JSON.stringify(this.defaults, null, "  ")
      fs.writeFile(filepath, data, (err) => {
        if (err) {
          callback(err)
          return
        }
        callback()
      })
    } else {
      callback()
    }
  }

  load(filepath, callback) {
    if (filepath) {
      if (this.defaults !== null) {
        callback(null, this.defaults)
        return
      }
      fs.readFile(filepath, "utf8", (err, data) => {
        if (err) {
          callback(null, "")
          return
        }
        try {
          const json = JSON.parse(data.toString())
          this.defaults = json
          callback(null, json)
          return
        } catch (err) {}
        this.defaults = data
        callback(null, data)
      })
    } else {
      callback(new Error("user defaults filepath not defined"), "")
    }
  }
}

const userDefaults = new UserDefaults()
export default userDefaults

async function main() {
  const save = (data) => {
    return new Promise<void>((resolved) => {
      userDefaults.save(process.argv[2], data, (err) => {
        resolved()
      })
    })
  }
  const load = () => {
    return new Promise((resolved) => {
      userDefaults.load(process.argv[2], (err, data) => {
        resolved(data)
      })
    })
  }
  async function test() {
    let data
    data = await load()
    Log.info(data)
    await save("hello")
    data = await load()
    Log.info(data)
    await save({ value1: "A", value2: "B" })
    data = await load()
    Log.info(data)
    await save({ value3: "C", value2: "D" })
    data = await load()
    Log.info(data)
    await save("hello")
    data = await load()
    Log.info(data)
  }
  test()
}

if (require.main === module) {
  if (process.argv.length > 2 && process.argv[2]) {
    main()
  }
}
