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
    for (var i=0;i<buffer.length;i+=waveSkip*2) {
      let maxSample = 0;
      for (var j=i;j<i+waveSkip*2;j+=2) {
        let sample = 0;
        if(buffer[j+1] > 128) {
            sample = (buffer[j+1] - 256) * 256;
        } else {
            sample = buffer[j+1] * 256;
        }
        sample += buffer[j];
        if (abs(maxSample) < abs(sample)) {
          maxSample = sample;
        }
      }
      a.push({
        y: maxSample,
      });
    }
    return a;
  }

  var t = new EventEmitter();
  t.recording = false;
  t.writing = true;
  t.recordingTime = 0;
  t.state = 'recoding-stop';

  const defaultRequestOpts = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'ja-JP',
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
        if (params.threshold !== 'keep') {
          delete params.threshold;
        }
      }
      if ('level' in params) {
        if (params.level !== 'keep') {
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
    if ('languageCode' in params) {
      if (typeof params.languageCode === 'string') {
        const opts = { ...defaultRequestOpts, };
        opts.languageCode = params.languageCode.trim();
        requestOpts.push(opts);
      } else {
        params.languageCode.forEach( (code, i) => {
          const opts = { ...defaultRequestOpts, };
          opts.config = { ...defaultRequestOpts.config };
          opts.config.languageCode = code.trim();
          requestOpts.push(opts);
        })
      }
    } else {
      requestOpts.push({ ...defaultRequestOpts, });
    }
    streamQue = [];
    console.log('startRecording');
    console.log(JSON.stringify(requestOpts,null,'  '));
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

  micInputStream.on('data', function (data) {
    if (streamDataReuest) {
      t.emit('wave-data', {
        state: t.state,
        wave: uint8toint16(data),
        threshold: micInputStream.silent_threshold,
        level: micInputStream.mic_level,
      });
    }
    if (micInputStream.incrConsecSilenceCount() > micInputStream.getNumSilenceFramesExitThresh()) {
      streamQue.push(data);
      streamQue = streamQue.slice(-PRELOAD_COUNT);
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
              console.error(err);
            })
            .on('data', (data) => {
              if (data.results[0] && data.results[0].alternatives[0]) {
                const alternatives = data.results[0].alternatives.map(v => v);
                const sentence = alternatives.shift();
                console.log(JSON.stringify(data));
                if (!t.recording) return;
                const result = {
                  languageCode: opts.config.languageCode,
                  transcript: sentence.transcript,
                  confidence: sentence.confidence,
                }
                const emitResult = (result) => {
                  console.log(`result ${JSON.stringify(result,null,'  ')}`);
                  t.emit('data', result);
                  if (!t.writing) {
                    t.recording = false;
                  }
                }
                if (rec_length > 1) {
                  results.push(result);
                  if (results.length == 1) {
                    setTimeout(() => {
                      let candidate = results[0];
                      for (var i=0;i<results.length;i++) {
                        if (candidate.confidence < results[i].confidence) {
                          candidate = results[i];
                        }
                      }
                      emitResult(candidate);
                    }, 1000)
                    return;
                  }
                  return;
                }
                emitResult(result);
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
        if (streamQue.length > 0) {
          streamQue.forEach( data => {
            recognizeStreams.forEach( stream => stream.write(data) );
          })
          streamQue = [];
        }
        recognizeStreams.forEach( stream => stream.write(data) );
      } else {
        streamQue.push(data);
        streamQue = streamQue.slice(-PRELOAD_COUNT);
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

  sp.recording = true;
  sp.emit('startRecording', { languageCode: [ 'ja-JP', ] });
  // sp.emit('startRecording', { languageCode: [ 'ja-JP', 'en-US' ] });
  sp.on('wave-data', function (data) {
    ioa.emit('wave-data', data);
  });

}
