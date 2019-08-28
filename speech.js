const EventEmitter = require('events');
const speech = require('@google-cloud/speech');
const mic = require('mic');
const config = require('./config');

const PRELOAD_COUNT = 3;

function Speech() {
  let waveSkip = 80;

  function uint8toint16(buffer) {
    function abs(a) { return (a>0)?a:(-a); };
    const a = [];
    let _waveSkip = waveSkip;
    if (_waveSkip > buffer.length/2) _waveSkip = buffer.length/2;
    for (var i=0;i<buffer.length;i+=_waveSkip*2) {
      let maxSample = null;
      let sum = 0;
      let buff = [];
      for (var j=i;j<i+_waveSkip*2;j+=2) {
        let sample = 0;
        if(buffer[j+1] > 128) {
            sample = (buffer[j+1] - 256) * 256;
        } else {
            sample = buffer[j+1] * 256;
        }
        sample += buffer[j];
        sum += sample;
        buff.push(sample);
      }
      const avg = sum / buff.length;
      buff.forEach( sample => {
        if (maxSample === null || abs(maxSample) < abs(sample-avg)) {
          maxSample = sample-avg;
        }
      })
      a.push({
        y: maxSample,
      });
    }
    return a;
  }

  var t = new EventEmitter();
  t.recording = false;
  t._recording = false;
  t._preloadRecording = false;
  // t._preloadRecordingTimeout = null;
  t.writing = true;
  t.recordingTime = 0;
  t.state = 'recoding-stop';

  const defaultRequestOpts = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'ja-JP',
      alternativeLanguageCodes: null,
      maxAlternatives: 3,
    },
    interimResults: false,
  };

  if (config.voiceHat == true && config.usbUSBMIC == false) {
    var device = 'plug:micboost';
  } else {
    var device = config.usbUSBMICDevice;  //e.g. 'plughw:1,0';
  }
  var micInstance = mic({
    'device': device,
    'rate': '16000',
    'channels': '1',
    'debug': false,
    'exitOnSilence': 6,
  });
  var micInputStream = micInstance.getAudioStream();
  t.stream = micInputStream

  var recognizeStream = null;
  var recognizeStreams = null;
  var requestOpts = [{ ...defaultRequestOpts }];
  var startTime = 0;
  var writingStep = 0;
  var speechClients = [];
  var streamQue = [];
  var streamDataReuest = false;

  speechClients[0] = new speech.SpeechClient();

  // マイクの音声認識の閾値を変更
  t.on('mic_threshold', function (threshold) {
    if (threshold !== 'keep') {
      if (micInputStream.changeParameters) {
        micInputStream.changeParameters({ threshold, });
      } else
      if (micInputStream.changeSilentThreshold) {
        micInputStream.changeSilentThreshold(threshold);
      }
    }
  });

  // 音声解析開始
  t.on('startRecording', function (params) {
    if (micInputStream.changeParameters) {
      if ('threshold' in params) {
        if (params.threshold === 'keep') {
          delete params.threshold;
        }
      }
      if ('level' in params) {
        if (params.level === 'keep') {
          delete params.level;
        }
      }
      micInputStream.changeParameters(params);
    } else
    if (micInputStream.changeSilentThreshold) {
      if ('threshold' in params) {
        if (params.threshold !== 'keep') {
          micInputStream.changeSilentThreshold(params.threshold);
        }
      }
    }
    requestOpts = [];
    const opts = { ...defaultRequestOpts, };
    let alternativeLanguageCodes = {};
    if ('alternativeLanguageCodes' in params) {
      if (params.alternativeLanguageCodes) {
        const t = params.alternativeLanguageCodes.trim().split('/');
        t.forEach( v => {
          alternativeLanguageCodes[v] = true;
        })
      }
    }
    if ('languageCode' in params) {
      if (typeof params.languageCode === 'string') {
        opts.languageCode = params.languageCode.trim();
      } else {
        params.languageCode.forEach( (code, i) => {
          if (i==0) {
            opts.config = { ...defaultRequestOpts.config };
            opts.config.languageCode = code.trim();
          } else {
            alternativeLanguageCodes[code.trim()] = true;
          }
        })
      }
    }
    if (Object.keys(alternativeLanguageCodes).length > 0) {
      opts.alternativeLanguageCodes = [ ...Object.keys(alternativeLanguageCodes) ];
    }
    requestOpts.push(opts);
    streamQue = [];
    console.log('startRecording');
    console.log(JSON.stringify(requestOpts, null, '  '));
  });

  // 音声解析終了
  t.on('stopRecording', function () {
    console.log('stopRecording');
  });

  //解析用ストリームデータを送信開始
  t.on('startStreamData', function() {
    streamDataReuest = true;
  });

  //解析用ストリームデータを送信停止
  t.on('stopStreamData', function() {
    streamDataReuest = false;
  });

  t.setParams = function(params) {
    if (micInputStream.changeParameters) {
      if ('threshold' in params) {
        if (params.threshold === 'keep') {
          delete params.threshold;
        }
      }
      if ('level' in params) {
        if (params.level === 'keep') {
          delete params.level;
        }
      }
      micInputStream.changeParameters(params);
    }
  }

  micInputStream.on('data', function (data) {
    if (t.recording && !t._recording) {
      streamQue = []
      t._preloadRecording = true;
      // if (t._preloadRecordingTimeout) clearTimeout(t._preloadRecordingTimeout);
      // t._preloadRecordingTimeout = setTimeout(() => {
      // }, 1000)
    }
    if (!t.recording) {
      // if (t._preloadRecordingTimeout) clearTimeout(t._preloadRecordingTimeout);
      // t._preloadRecordingTimeout = null;
      t._preloadRecording = false;
    }
    t._recording = t.recording;
    if (streamDataReuest) {
      t.emit('wave-data', {
        state: t.state,
        wave: uint8toint16(data),
        threshold: micInputStream.silent_threshold,
        level: micInputStream.mic_level,
      });
    }
    if (micInputStream.incrConsecSilenceCount() >= micInputStream.getNumSilenceFramesExitThresh()) {
      if (t._preloadRecording) {
        streamQue.push(data);
        streamQue = streamQue.slice(-PRELOAD_COUNT);
      }
      if (writingStep == 1) {
        console.log('end writing');
        writingStep = 0;
      }
      if (recognizeStreams) {
        console.log('endStream A');
        recognizeStreams.forEach( stream => stream.end() );
        recognizeStreams = null;
        if (startTime > 0) {
          t.recordingTime += (new Date()).getTime() - startTime;
          startTime = 0;
        }
      }
    } else {
      if (recognizeStreams == null && t.recording) {
        console.log('startStream');
        startTime = (new Date()).getTime();
        recognizeStreams = [];
        const rec_length = requestOpts.length;
        const results = [];
        requestOpts.forEach( (opts, i) => {
          const client = ((i) => {
            if (speechClients[i] == null) {
              speechClients[i] = new speech.SpeechClient();
            }
            return speechClients[i];
          })(i);
          console.log('createStream');
          recognizeStreams.push(client.streamingRecognize(opts)
            .on('error', (err) => {
              console.log('error' , JSON.stringify(opts));
              console.log(err);
              // if (!t.recording) return;
              // const result = {
              //   languageCode: opts.config.languageCode,
              //   errorString: err.toString(),
              //   transcript: 'error',
              //   confidence: 0,
              //   payload: 'error',
              // }
              // t.emit('data', result);
              // if (!t.writing) {
              //   t.recording = false;
              // }
            })
            .on('data', (data) => {
              console.log(JSON.stringify(data, null, '  '));
              if (!t.recording) return;
              const emitResult = (result) => {
                console.log(`result ${JSON.stringify(result, null, '  ')}`);
                t.emit('data', result);
                if (!t.writing) {
                  t.recording = false;
                }
              }
              if (data.results) {
                let candidate = {
                  confidence: 0,
                };
                data.results.forEach( result => {
                  const languageCode = result.languageCode;
                  result.alternatives.forEach( alt => {
                    if (candidate.confidence < alt.confidence) {
                      candidate = alt;
                      candidate.languageCode = languageCode;
                    }
                  })
                })
                emitResult(candidate);
              }
            })
          )
        });
      }
      if (t.recording && t.writing) {
        if (writingStep == 0) {
          console.log('start writing');
          writingStep = 1;
        }
        if (t._preloadRecording) {
          streamQue.forEach( data => {
            recognizeStreams.forEach( stream => stream.write(data) );
          })
          recognizeStreams.forEach( stream => stream.write(data) );
          streamQue = [];
        } else {
          recognizeStreams.forEach( stream => stream.write(data) );
        }
      } else {
        if (t._preloadRecording) {
          streamQue.push(data);
          streamQue = streamQue.slice(-PRELOAD_COUNT);
        }
        if (writingStep == 1) {
          console.log('end writing');
          writingStep = 0;
        }
        if (recognizeStreams) {
          console.log('endStream B');
          recognizeStreams.forEach( stream => stream.end() );
          recognizeStreams = null;
          if (startTime > 0) {
            t.recordingTime += (new Date()).getTime() - startTime;
            startTime = 0;
          }
        }
      }
    }
    if (writingStep == 1 && !t.recording) {
      console.log('end writing');
      writingStep = 0;
    }
  })

  micInputStream.on('error', function (err) {
    console.log("Error in Input Stream: " + err);
  });

  micInputStream.on('startComplete', function () {
    console.log("Got SIGNAL startComplete");
    t.status = 'start';
  });

  micInputStream.on('stopComplete', function () {
    console.log("Got SIGNAL stopComplete");
    t.status = 'stop';
  });

  micInputStream.on('pauseComplete', function () {
    console.log("Got SIGNAL pauseComplete");
    t.status = 'pause';
  });

  micInputStream.on('resumeComplete', function () {
    console.log("Got SIGNAL resumeComplete");
    t.status = 'start';
  });

  micInputStream.on('silence', function () {
    //console.log("Got SIGNAL silence");
  });

  micInputStream.on('processExitComplete', function () {
    console.log("Got SIGNAL processExitComplete");
  });

  micInputStream.on('speech-start', function () {
    console.log("Got SIGNAL speech-start");
    t.state = 'recoding-start';
  });

  micInputStream.on('speech-stop', function () {
    console.log("Got SIGNAL speech-stop");
    t.state = 'recoding-stop';
  });

  micInstance.start();

  return t;
}

const sp = Speech();
module.exports = sp;

if (require.main === module) {

  const express = require('express')
  const socketIO = require('socket.io');
  const PORT = 4300;

  const app = express()

  app.post('/access-token', function(req, res) {
    res.json({ user_id: 'no-name', signature: 'dummy', });
  });

  const server = require('http').Server(app);
  server.listen(PORT, () => console.log(`server listening on port ${PORT}!`))

  const io = new socketIO(server);
  const ioa = io.of('audio');

  const clients = {};

  ioa.on('connection', (socket) => {
    console.log('connected')
    socket.on('start-stream-data', (payload) => {
      console.log('startStreamData', JSON.stringify(payload));
      if (Object.keys(clients).length == 0) {
        sp.emit('startStreamData');
      }
      clients[socket.id] = socket;
    })
    socket.on('speech-config', (params) => {
      console.log(params);
      sp.stream.changeParameters(params);
    })
    socket.on('disconnect', () => {
      delete clients[socket.id];
      if (clients.length == 0) {
        sp.emit('stopStreamData');
      }
    })
  })

  const threshold = (() => {
    if (process.argv.length > 2 && process.argv[2]) {
      return parseInt(process.argv[2])
    }
    return 4000;
  })()

  console.log(`threshold ${threshold}`);

  sp.recording = true;
  sp.emit('startRecording', {
    languageCode: [ 'ja-JP', ],
    threshold,
  });
  // sp.emit('startRecording', {
  //   languageCode: [ 'ja-JP', 'en-US' ]
  //   threshold,
  // });
  sp.on('wave-data', function (data) {
    ioa.emit('wave-data', data);
  });

}
