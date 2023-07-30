import * as fs from "fs"
const readline = require("readline")
const { google } = require("googleapis")

let google_sheet = {
  credentials: null,
  token: null,
}
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

const loadCredential = (config, callback) => {
  if (google_sheet.credentials === null) {
    fs.readFile(config.credentialPath, "utf8", (err, content) => {
      if (err) return callback(err)
      google_sheet.credentials = JSON.parse(content.toString())
      callback(null, google_sheet.credentials)
    })
    return
  }
  callback(null, google_sheet.credentials)
}

const getNewToken = (config, oAuth2Client, callback) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  })
  console.log("Authorize this app by visiting this url:", authUrl)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  rl.question("Enter the code from that page here: ", (code) => {
    rl.close()
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        console.error("Error while trying to retrieve access token", err)
        return callback(err)
      }
      fs.writeFile(config.tokenPath, JSON.stringify(token), (err) => {
        if (err) {
          console.error(err)
          return callback(err)
        }
        callback(err, token)
      })
    })
  })
}

const getToken = (config, oAuth2Client, callback) => {
  if (google_sheet.token === null) {
    fs.readFile(config.tokenPath, "utf8", (err, content) => {
      if (err) {
        return callback(err)
      }
      google_sheet.token = JSON.parse(content.toString())
      callback(null, google_sheet.token)
    })
    return
  }
  callback(null, google_sheet.token)
}

function appendGoogleSheet({ credentialPath, tokenPath, sheetId }, payload, callback) {
  if (credentialPath !== null && tokenPath !== null && sheetId !== null) {
    const config = { credentialPath, tokenPath }
    const appendData = (sheets, title, values, callback) => {
      console.log(`append-to-sheet ${sheetId}:${title}, ${JSON.stringify(values)}`)
      sheets.spreadsheets.values.append(
        {
          spreadsheetId: sheetId,
          range: `${title}!A1`,
          valueInputOption: "USER_ENTERED",
          resource: {
            values,
          },
        },
        callback
      )
    }
    const addSheet = (sheets, title, callback) => {
      sheets.spreadsheets.batchUpdate(
        {
          spreadsheetId: sheetId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title,
                  },
                },
              },
            ],
          },
        },
        callback
      )
    }
    const getSheetList = (sheets, callback) => {
      sheets.spreadsheets.get(
        {
          spreadsheetId: sheetId,
        },
        callback
      )
    }
    loadCredential(config, (err, credentials) => {
      if (err) return callback(err)
      const { client_secret, client_id, redirect_uris } = credentials.installed
      const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
      getToken(config, auth, (err, token) => {
        if (err) return callback(err)
        auth.setCredentials(token)
        const sheets = google.sheets({ version: "v4", auth })
        const today = new Date()
        const title = `${today.getFullYear()}-${("00" + (today.getMonth() + 1)).slice(-2)}`
        //データを追加
        appendData(sheets, title, payload, (err, result) => {
          if (err) {
            //追加できない、エラー
            if (err.code === 400) {
              return getSheetList(sheets, (err, result) => {
                if (err) return callback(err)
                //シートがあるか調べる
                if (
                  !result.data.sheets.some((v) => {
                    return v.properties.title === title
                  })
                ) {
                  //シートを追加
                  addSheet(sheets, title, (err, result) => {
                    if (err) return callback(err)
                    //データを追加
                    appendData(sheets, title, payload, (err, result) => {
                      if (err) return callback(err)
                      callback(err, result)
                    })
                  })
                } else {
                  //シートはあるのになぜかエラー
                  callback(new Error("operation error"))
                }
              })
            }
          }
          callback(err, result)
        })
      })
    })
  }
}

function readAllGoogleSheet({ credentialPath, tokenPath, sheetId, sheetName, range }, callback) {
  if (credentialPath !== null && tokenPath !== null && sheetId !== null && sheetName !== null) {
    range = range ? range : "A1:E"
    const config = { credentialPath, tokenPath }
    loadCredential(config, (err, credentials) => {
      if (err) {
        return callback(err)
      }
      const { client_secret, client_id, redirect_uris } = credentials.installed
      const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
      getToken(config, auth, (err, token) => {
        if (err) {
          return callback(err)
        }
        auth.setCredentials(token)
        console.log(`read-from-sheet ${sheetId}:${sheetName}`)
        const sheets = google.sheets({ version: "v4", auth })
        sheets.spreadsheets.values.get(
          {
            spreadsheetId: sheetId,
            range: `${sheetName}!${range}`,
          },
          (err, res) => {
            if (err) return callback(err)
            const rows = res.data.values
            callback(null, rows)
          }
        )
      })
    })
  } else {
    callback(new Error("google sheet read error"))
  }
}

const loadSheet = (sheetInfo, callback) => {
  readAllGoogleSheet(sheetInfo, (err, data) => {
    if (err) return callback(err)
    const head = []
    const newdata = []
    data.forEach((v, i) => {
      if (i == 0) {
        v.forEach((k) => {
          head.push(k)
        })
      } else {
        const t = {}
        v.forEach((v, i) => {
          t[head[i]] = v
        })
        newdata.push(t)
      }
    })
    callback(null, newdata, head)
  })
}

export default {
  append: appendGoogleSheet,
  readAll: readAllGoogleSheet,
  loadSheet,
}
