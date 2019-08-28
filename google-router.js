const express = require('express');
const router = express.Router();
const config = require('./config');
const { spawn } = require('child_process');
const fs = require('fs');
const googleSpeech = (() => {
  if ('synthesizeSpeech' in config
   && 'credentialPath' in config.synthesizeSpeech
   && config.synthesizeSpeech.credentialPath) {
    try {
      const textToSpeech = require('@google-cloud/text-to-speech');
      const ret = new textToSpeech.TextToSpeechClient();
      console.log('google text-to-speech initialized.');
      return ret;
    } catch(err) {
      console.log(err);
    }
  }
  console.log('google text-to-speech disabled.');
  return null;
})();
const polly = (() => {
  if ('synthesizeSpeech' in config
   && 'awsCredentialPath' in config.synthesizeSpeech
   && config.synthesizeSpeech.awsCredentialPath) {
    try {
      const aws = require('aws-sdk');
      aws.config.loadFromPath(config.synthesizeSpeech.awsCredentialPath);
      const polly = new aws.Polly({apiVersion: '2016-06-10',region:'us-west-2'});
      console.log('aws text-to-speech initialized.');
      return polly;
    } catch(err) {
      console.log(err);
    }
  }
  console.log('aws text-to-speech disabled.');
  return null;
})();
const crypto = require('crypto');
const path = require('path');
const readline = require('readline');
const {google} = require('googleapis');
const utils = require('./utils');
const FileWriter = require('wav').FileWriter;
const { Readable } = require('stream');
const googleTranslate = (() => {
  if ('googleTranslate' in config
   && 'credentialPath' in config.googleTranslate
   && config.googleTranslate.credentialPath
   && config.googleTranslate.projectId) {
    try {
      const {TranslationServiceClient} = require('@google-cloud/translate').v3beta1;
      const translationClient = new TranslationServiceClient();
      console.log('google translate api initialized.');
      return async function(text, source, target) {
        // Construct request
        const request = {
          parent: translationClient.locationPath(config.googleTranslate.projectId, config.googleTranslate.location),
          contents: [text],
          mimeType: 'text/plain', // mime types: text/plain, text/html
          sourceLanguageCode: source ? source : 'ja',
          targetLanguageCode: target ? target : 'en',
        };
        // Run request
        const [response] = await translationClient.translateText(request);
        return response.translations.map( t => t.translatedText );
      };
    } catch(err) {
      console.log(err);
    }
  }
  console.log('google translate api disabled.');
  return null;
})();

const cacheDBPath = ('synthesizeSpeech' in config && 'cacheDBPath' in config.synthesizeSpeech)?config.synthesizeSpeech.cacheDBPath:null;

const cacheDB = (() => {
  if (cacheDBPath) {
    try {
      const data = fs.readFileSync(cacheDBPath);
      const json = JSON.parse(data);
      Object.keys(json).forEach( key => {
        if ('atime' in json[key]) json[key].atime = new Date(json[key].atime);
        if ('ctime' in json[key]) json[key].ctime = new Date(json[key].ctime);
      })
      return json;
    } catch(err) {
      if (err.code === 'ENOENT') {
        console.log(`no such file or directory, open '${cacheDBPath}'`);
      } else {
        console.log(err);
      }
    }
  }
  return {};
})();

const saveCacheDB = (() => {
  let counter = 0;
  let writing = false;
  let lastCacheDB = null;
  const write = () => {
    if (cacheDBPath) {
      if (!writing) {
        writing = true;
        counter = 0;
        const t = JSON.stringify(cacheDB);
        const nextWrite = () => {
          if (counter > 0) {
            setTimeout(() => {
              writing = false;
              write();
            }, 1000);
          } else {
            writing = false;
          }
        }
        if (lastCacheDB !== t) {
          lastCacheDB = t;
          fs.writeFile(cacheDBPath, lastCacheDB, (err) => {
            nextWrite();
          });
        } else {
          nextWrite();
        }
      } else {
        counter ++;
      }
    }
  }
  return write;
})();

router.get('/health', (req, res) => {
  res.send('OK\n');
})

let text_to_speech = {
  playone: null,
}

function ReqTextToSpeech(req, res, mode='play') {
  let text = 'こんにちは';

  let voice = {};
  let audioConfig = {};
  let action = 'play';

  if ('action' in req.body) {
    action = req.body.action;
  }

  if (action === 'stop') {
    if (text_to_speech.playone) {
      utils.kill(text_to_speech.playone.pid, 'SIGTERM', function () {
      });
      text_to_speech.playone = null;
    }
    return res.send('OK\n');
  }

  if ('languageCode' in req.body) {
    voice.languageCode = req.body.languageCode;
  } else {
    voice.languageCode = 'ja-JP';
  }

  if ('voiceId' in req.body) {
    voice.voiceId = req.body.voiceId;
  } else {
    voice.voiceId = null;
  }

  if ('ssmlGender' in req.body) {
    voice.ssmlGender = req.body.ssmlGender;
  } else {
    voice.ssmlGender = 'NEUTRAL';
  }

  if ('audioEncoding' in req.body) {
    audioConfig.audioEncoding = req.body.audioEncoding;
  } else {
    audioConfig.audioEncoding = 'LINEAR16';
  }

  if ('speakingRate' in req.body) {
    audioConfig.speakingRate = req.body.speakingRate;
  }

  if ('pitch' in req.body) {
    audioConfig.pitch = req.body.pitch;
  }

  if ('name' in req.body) {
    voice.name = req.body.name;
  }

  if ('text' in req.body) {
    text = req.body.text;
  }

  // Construct the request
  const request = {
    input: { text },
    // Select the language and SSML Voice Gender (optional)
    voice,
    // Select the type of audio encoding
    audioConfig,
  };

  console.log(request);

  const cacheFilePath = (filename) => {
    return path.join(config.synthesizeSpeech.tempdir, filename);
  }

  const playone = (sndfilepath, callback) => {
    if (mode === 'silence') return callback(null, 0);
    const cmd = (process.platform === 'darwin') ? 'afplay' : 'aplay';
    const opt = (process.platform === 'darwin') ? [sndfilepath] : ['-Dplug:softvol', sndfilepath];
    console.log(`/usr/bin/${cmd} ${sndfilepath}`);
    text_to_speech.playone = spawn(`/usr/bin/${cmd}`, opt);
    text_to_speech.playone.on('close', function(code) {
      text_to_speech.playone = null;
      callback(null, code);
    });
  }

  const limitCacheFile = (cacheDB, maxsize, callback) => {
    if (maxsize) {
      const maxsizebyte = 1024*1024*maxsize;
      let totalsize = 0;
      for (key in cacheDB) totalsize += cacheDB[key].size;
      const sortedCache = (() => {
        const t = [];
        for (key in cacheDB) {
          t.push(cacheDB[key]);
        }
        return t.sort( (a,b) => {
          if (a.counter > b.counter) return -1;
          if (a.counter < b.counter) return  1;
          if (a.atime.getTime() > b.atime.getTime()) return -1;
          if (a.atime.getTime() < b.atime.getTime()) return  1;
          return 0;
        })
      })();
      if (totalsize > maxsizebyte) {
        let sizesum = 0;
        sortedCache.forEach( v => {
          sizesum += v.size;
          if (sizesum > maxsizebyte) {
            if (v.filename) {
              fs.unlink(cacheFilePath(v.filename), (err) => {
              });
              delete cacheDB[v.filename];
              saveCacheDB();
            }
          }
        })
      }
    }
    callback();
  }

  const requestSynthesizeSpeech = (request, sndfilepath, callback) => {
    limitCacheFile(cacheDB, config.synthesizeSpeech.maxCacheSize, () => {
      if (request.voice.languageCode === 'open-jTalk') {
        const cmd = (process.platform === 'darwin') ? 'talk-open-jTalk-mac.sh' : 'talk-open-jTalk-raspi.sh';
        const p = path.join(__dirname, cmd)
        const opt = [
          'mei_normal',
          request.input.text,
          sndfilepath,
        ]
        const recording = spawn(p, opt);
        recording.on('close', function(code) {
          callback(null, sndfilepath);
        });
      } else
      if (request.voice.languageCode.indexOf('aws') >= 0) {
        if (!polly) {
          callback(new Error('AWS Polly is disabled.'));
          return;
        }
        const playone = (VoiceId, Text) => {
          polly.synthesizeSpeech({
            OutputFormat: 'pcm',
            VoiceId,
            Text,
            SampleRate: '16000',
            TextType: 'text'
          }).promise()
            .then(data => {
              var outputFileStream = new FileWriter(sndfilepath, {
                sampleRate: 16000,
                channels: 1
              });
              const readable = new Readable()
              readable.push(data.AudioStream)
              readable.push(null)
              readable.pipe(outputFileStream);
              outputFileStream.on('error', (err) => {
                callback(err);
              });
              outputFileStream.on('end', () => {
                callback(null, sndfilepath);
              });
            })
            .catch(err => {
              callback(err);
            });
        }
        if (request.voice.voiceId) {
          playone(request.voice.voiceId, request.input.text);
        } else {
          let LanguageCode = '';
          try {
            LanguageCode = request.voice.languageCode.split('.')[1].trim()
          } catch(err) {
            callback(err);
            return;
          }
          polly.describeVoices({
            LanguageCode,
          }).promise()
          .then(data => {
            playone(data.Voices[0].Id, request.input.text);
          })
          .catch(err => {
            callback(err);
          });
        }
      } else {
        if (!googleSpeech) {
          callback(new Error('Google TextToSpeech is disabled.'));
          return;
        }
        googleSpeech.synthesizeSpeech(request, (err, response) => {
          if (err) {
            callback(err);
            return;
          }
          fs.writeFile(sndfilepath, response.audioContent, 'binary', err => {
            if (err) {
              callback(err);
              return;
            }
            callback(null, sndfilepath);
          });
        });
      }
    });
  }

  const filename = `robot-snd-${crypto.createHash('md5').update(JSON.stringify(request)).digest("hex")}.${(audioConfig.audioEncoding==='LINEAR16')?'wav':'mp3'}`;
  const sndfilepath = cacheFilePath(filename);
  fs.access(sndfilepath, fs.constants.R_OK, (err) => {
    if (err || !(filename in cacheDB) || cacheDB[filename].text !== text) {
      //ファイルがないので作成
      requestSynthesizeSpeech(request, sndfilepath, (err) => {
        if (err) {
          console.log('ERROR:', err);
          res.send('NG\n');
          return;
        }
        fs.stat(sndfilepath, (err, stats) => {
          if (err) {
            console.log('ERROR:', err);
            res.send('NG\n');
            return;
          }
          playone(sndfilepath, (err, code) => {
            if (err) {
              console.log('ERROR:', err);
              res.send('NG\n');
              return;
            }
            console.log('close', code);
            cacheDB[filename] = {
              text,
              filename,
              ctime: new Date(),
              atime: new Date(),
              counter: 0,
              size: (stats.size/512*512)+(((stats.size%512)===0)?0:512),
            };
            saveCacheDB();
            res.send('OK\n');
          })
        })
      })
    } else {
      //ファイルがあるので再生
      playone(sndfilepath, (err, code) => {
        if (err) {
          console.log('ERROR:', err);
          res.send('NG\n');
          return;
        }
        console.log('close', code);
        cacheDB[filename].counter ++;
        cacheDB[filename].atime = new Date();
        saveCacheDB();
        res.send('OK\n');
      })
    }
  });
}

router.post('/init-text-to-speech', (req, res) => {
  ReqTextToSpeech(req, res, 'silence');
})

router.post('/text-to-speech', (req, res) => {
  ReqTextToSpeech(req, res);
})

router.post('/translate', async (req, res) => {
  try {
    const { text, source, target } = req.body;
    let [translations] = await googleTranslate(text, source, target);
    translations = Array.isArray(translations) ? translations : [translations];
    res.json(translations);
  } catch(err) {
    console.log(err);
    res.json([`[error: ${err.message}]`]);
  }
})

let google_sheet = {
  credentials: null,
  token: null,
  cache: [],
  writing: false,
}
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const loadCredential = (callback) => {
  if (google_sheet.credentials === null) {
    fs.readFile(config.googleSheet.credentialPath, (err, content) => {
      if (err) return callback(err);
      google_sheet.credentials = JSON.parse(content);
      callback(null, google_sheet.credentials);
    })
    return;
  }
  callback(null, google_sheet.credentials);
}

const getNewToken = (oAuth2Client, callback) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return callback(err);
      }
      fs.writeFile(config.googleSheet.tokenPath, JSON.stringify(token), (err) => {
        if (err) {
          console.log(err);
          return callback(err);
        }
        callback(err, token);
      })
    })
  });
}

const getToken = (oAuth2Client, callback) => {
  if (google_sheet.token === null) {
    fs.readFile(config.googleSheet.tokenPath, (err, content) => {
      if (err) {
        return callback(err);
      }
      google_sheet.token = JSON.parse(content);
      callback(null, google_sheet.token);
    })
    return;
  }
  callback(null, google_sheet.token);
}

function apeendToSheet({ sheetId, payload, }, callback) {
  const appendData = (sheets, title, values, callback) => {
    console.log(`append-to-sheet ${sheetId}, ${JSON.stringify(values)}`);
    sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${title}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values,
      },
    }, callback)
  }
  const addSheet = (sheets, title, callback) => {
    sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title,
              },
            },
          }
        ],
      },
    }, callback);
  }
  const getSheetList = (sheets, callback) => {
    sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    }, callback);
  }
  loadCredential((err, credentials) => {
    if (err) {
      return callback(err);
    }
    if (credentials === null || (!credentials.installed)) {
      return callback(new Error('Error: spread sheet credentials is null'));
    }
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    getToken(auth, (err, token) => {
      if (err) return callback(err);
      auth.setCredentials(token);
      const sheets = google.sheets({version: 'v4', auth});
      const today = new Date();
      const title = `${today.getFullYear()}-${('00'+(today.getMonth()+1)).slice(-2)}`;
      //データを追加
      appendData(sheets, title, payload, (err, result) => {
        if (err) {
          //追加できない、エラー
          if (err.code === 400) {
            return getSheetList(sheets, (err, result) => {
              if (err) return callback(err);
              //シートがあるか調べる
              if (!result.data.sheets.some( v => {
                return (v.properties.title === title);
              })) {
                //シートを追加
                addSheet(sheets, title, (err, result) => {
                  if (err) return callback(err);
                  //データを追加
                  appendData(sheets, title, payload, (err, result) => {
                    if (err) return callback(err);
                    callback(err, result);
                  })
                })
              } else {
                //シートはあるのになぜかエラー
                callback(new Error('operation error'));
              }
            })
          }
        }
        callback(err, result);
      });
    })
  })
}

router.post('/append-to-sheet', (req, res) => {
  if (config.googleSheet.credentialPath !== null && config.googleSheet.tokenPath !== null) {
    const { sheetId, payload } = req.body;
    const delayTime = 1000;

    if (google_sheet.cache.length >= 100) {
      res.send('NG overflow\n');
      return;
    }
    google_sheet.cache.push({ sheetId, payload });

    const makeValues = (payload) => {
      if (typeof payload === 'undefined') return [];
      if (typeof payload === 'string') return [payload];
      if (Array.isArray(payload)) {
        return payload;
      }
      if (typeof payload === 'object') {
        return [Object.keys.sort().map( key => payload[key] )];
      }
      return [payload.toString()];
    }

    const append = (sheetId, payload) => {
      if (google_sheet.cache.length <= 0) {
        if (payload.length > 0) {
          apeendToSheet({ sheetId, payload }, (err) => {
            if (err) {
              console.error(err);
            }
            setTimeout(() => {
              append(null, []);
            }, delayTime);
          })
        } else {
          google_sheet.writing = false;
        }
        return;
      }
      google_sheet.writing = true;
      const p = google_sheet.cache.shift();
      const data = [ (new Date()).toLocaleString(), ...makeValues(p.payload) ];
      if (sheetId === null || sheetId === p.sheetId) {
        sheetId = p.sheetId;
        payload.push(data);
        append(sheetId, payload);
        return;
      }
      if (sheetId !== null && payload.length > 0) {
        apeendToSheet({ sheetId, payload }, (err) => {
          if (err) {
            console.error(err);
          }
          sheetId = p.sheetId;
          payload = [ data ];
          setTimeout(() => {
            append(sheetId, payload);
          }, delayTime);
        })
      } else {
        sheetId = p.sheetId;
        payload = [ data ];
        append(sheetId, payload);
      }
    }
    if (!google_sheet.writing) {
      setTimeout(() => {
        append(null, []);
      }, delayTime);
    }

    res.send('OK\n');
    return;
  }
  res.send('OK\n');
})

module.exports = router;

if (require.main === module) {
  // const PORT = process.env.PORT || 5000
  // const bodyParser = require('body-parser');
  // const app = express();
  // app.use(bodyParser.json({ type: 'application/json' }))
  // app.use(router);
  // const server = require('http').Server(app);
  // server.listen(PORT, () => console.log(`server listening on port ${PORT}!`))

  if (config.googleSheet.credentialPath !== null && config.googleSheet.tokenPath !== null) {
    loadCredential((err, credentials) => {
      if (err) {
        console.log(err);
        return;
      }
      if (credentials === null || (!credentials.installed)) {
        console.log(new Error('Error: spread sheet credentials is null'));
        return;
      }
      const {client_secret, client_id, redirect_uris} = credentials.installed;
      const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
      getToken(oAuth2Client, (err, token) => {
        if (err) {
          getNewToken(oAuth2Client, (err, token) => {
            if (err) {
              console.log(err);
              return;
            }
            console.log('token saved');
            process.exit(0);
          });
        } else {
          console.log('already exist token.');
          process.exit(0);
        }
      })
    })
  }
}
