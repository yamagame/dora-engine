const express = require('express');
const router = express.Router();
const config = require('./config');
const { spawn } = require('child_process');
const fs = require('fs');
const client = (() => {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const textToSpeech = require('@google-cloud/text-to-speech');
      const ret = new textToSpeech.TextToSpeechClient();
      console.log('google text-to-speech initialized.');
      return ret;
    } catch(err) {
      console.error(err);
    }
  }
  console.log('google text-to-speech is disabled.');
  return null;
})();
const crypto = require('crypto');
const path = require('path');
const cacheDB = {}

router.get('/health', (req, res) => {
  res.send('OK\n');
})

router.post('/text-to-speech', (req, res) => {
  let text = 'こんにちは';

  let voice = {};
  let audioConfig = {};

  if ('languageCode' in req.body) {
    voice.languageCode = req.body.languageCode;
  } else {
    voice.languageCode = 'ja-JP';
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

  if (!client) {
    console.error('ERROR:', 'TextToSpeechClient is disabled.');
    res.send('NG');
    return;
  }

  const cacheFilePath = (filename) => {
    return path.join(config.synthesizeSpeech.tempdir, filename);
  }

  const playone = (sndfilepath, callback) => {
    const cmd = (process.platform === 'darwin') ? 'afplay' : 'aplay';
    const opt = (process.platform === 'darwin') ? [sndfilepath] : ['-Dplug:softvol', sndfilepath];
    console.log(`/usr/bin/${cmd} ${sndfilepath}`);
    const playone = spawn(`/usr/bin/${cmd}`, opt);
    playone.on('close', function(code) {
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
            }
          }
        })
      }
    }
    callback();
  }

  const requestSynthesizeSpeech = (request, sndfilepath, callback) => {
    limitCacheFile(cacheDB, config.synthesizeSpeech.maxCacheSize, () => {
      client.synthesizeSpeech(request, (err, response) => {
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
    });
  }

  const filename = `robot-snd-${crypto.createHash('md5').update(JSON.stringify(request)).digest("hex")}.${(audioConfig.audioEncoding==='LINEAR16')?'wav':'mp3'}`;
  const sndfilepath = cacheFilePath(filename);
  fs.access(sndfilepath, fs.constants.R_OK, (err) => {
    if (err || !(filename in cacheDB) || cacheDB[filename].text !== text) {
      //ファイルがないので作成
      requestSynthesizeSpeech(request, sndfilepath, (err) => {
        if (err) {
          console.error('ERROR:', err);
          res.send('NG\n');
          return;
        }
        fs.stat(sndfilepath, (err, stats) => {
          if (err) {
            console.error('ERROR:', err);
            res.send('NG\n');
            return;
          }
          playone(sndfilepath, (err, code) => {
            if (err) {
              console.error('ERROR:', err);
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
            res.send('OK\n');
          })
        })
      })
    } else {
      //ファイルがあるので再生
      playone(sndfilepath, (err, code) => {
        if (err) {
          console.error('ERROR:', err);
          res.send('NG\n');
          return;
        }
        console.log('close', code);
        cacheDB[filename].counter ++;
        cacheDB[filename].atime = new Date();
        res.send('OK\n');
      })
    }
  });
  
})

module.exports = router;

if (require.main === module) {
  const PORT = process.env.PORT || 5000
  const bodyParser = require('body-parser');
  const app = express();
  app.use(bodyParser.json({ type: 'application/json' }))
  app.use(router);
  const server = require('http').Server(app);
  server.listen(PORT, () => console.log(`server listening on port ${PORT}!`))
}
