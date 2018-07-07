const EventEmitter = require('events');
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request-promise');
const speech = (() => (process.env['SPEECH'] === 'off') ? (new EventEmitter()) : require('./speech'))();
const talk = require('./talk');
const config = require('./config');
const APIKEY = config.docomo.api_key;
const APPID = config.docomo.app_id;
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const workFolder = 'DoraEngine';  //for macOS(development)
const buttonClient = require('./button-client')();
const RobotDB = require('./robot-db');
const USE_DB = config.use_db;
const saveInterval = 1000;

const HOME = (process.platform === 'darwin') ? path.join(process.env.HOME, 'Documents', workFolder) : process.env.HOME;
const PICT = (process.platform === 'darwin') ? path.join(process.env.HOME, 'Pictures', workFolder) : path.join(process.env.HOME, 'Pictures');

/*
{HOME}/robot-data.json
{HOME}/quiz-student.txt
{HOME}/date-list.txt
{HOME}/Documents/{username}/{script}
{HOME}/Sound/{sound file}
{HOME}/Pictures/{slide image file}
*/

const mkdirp = require('mkdirp');
const Dora = require('dora');
const dora = new Dora();
const utils = require('./utils');
const dateutlis = require('date-utils');

dora.loadModule('button', function(DORA, config) {
  function allBlink(node, options) {
    node.on("input", async function(msg) {
      buttonClient.emit('all-blink', {});
      node.send(msg);
    });
  }
  DORA.registerType('led-all-blink', allBlink);

  function allOn(node, options) {
    node.on("input", async function(msg) {
      buttonClient.emit('all-on', {
        bright: 1,
      });
      node.send(msg);
    });
  }
  DORA.registerType('led-all-on', allOn);

  function allOff(node, options) {
    node.on("input", async function(msg) {
      buttonClient.emit('all-off', {});
      node.send(msg);
    });
  }
  DORA.registerType('led-all-off', allOff);

  function ledOn(node, options) {
    node.on("input", async function(msg) {
      buttonClient.emit('one', {
        name: msg.button.name,
        bright: 1,
      });
      node.send(msg);
    });
  }
  DORA.registerType('led-on', ledOn);

  function sound(node, options) {
    var isTemplated = (options||"").indexOf("{{") != -1;
    node.on("input", async function(msg) {
      const socket = buttonClient.socket(msg.button.name);
      let message = options;
      if (isTemplated) {
        message = DORA.utils.mustache.render(message, msg);
      }
      socket.emit('sound-command', { sound: message });
      node.send(msg);
    });
  }
  DORA.registerType('sound', sound);

  function soundAll(node, options) {
    var isTemplated = (options||"").indexOf("{{") != -1;
    node.on("input", async function(msg) {
      let message = options;
      if (isTemplated) {
        message = DORA.utils.mustache.render(message, msg);
      }
      buttonClient.emit('sound', { sound: message });
      node.send(msg);
    });
  }
  DORA.registerType('sound-all', soundAll);

  function speechToText(node, options) {
    node.nextLabel(options);
    node.on("input", async function(msg) {
      const socket = buttonClient.socket(msg.button.name);
      const params = {
        timeout: 30000,
        sensitivity: 'keep',
      };
      if (typeof msg.timeout !== 'undefined') {
        params.timeout = msg.timeout;
      }
      if (typeof msg.sensitivity !== 'undefined') {
        params.sensitivity = msg.sensitivity;
      }
      node.recording = true;
      socket.emit('speech-to-text', params, (res) => {
        if (!node.recording) return;
        node.recording = false;
        if (res == '[timeout]') {
          msg.payload = 'timeout';
          node.send([msg, null]);
        } else
        if (res == '[canceled]') {
          msg.payload = 'canceled';
          node.send([msg, null]);
        } else
        if (res == '[camera]') {
          msg.payload = 'camera';
          node.send([msg, null]);
        } else {
          if (res.button) {
            msg.payload = 'button';
            msg.button = res;
            delete res.button;
            node.send([msg, null]);
          } else
          if (res.speechRequest) {
            msg.speechRequest = true;
            msg.payload = res.payload;
            msg.speechText = msg.payload;
            msg.topicPriority = 0;
            node.send([null, msg]);
          } else {
            msg.payload = res;
            msg.speechText = msg.payload;
            msg.topicPriority = 0;
            delete msg.speechRequest;
            node.send([null, msg]);
          }
        }
      });
    });
  }
  DORA.registerType('speech-to-text', speechToText);
});

dora.request = async function(command, options, params) {
  var len = 0;
  if (typeof command !== 'undefined') len += 1;
  if (typeof options !== 'undefined') len += 1;
  if (typeof params !== 'undefined') len += 1;
  if (len <= 0) {
    throw new Error('Illegal arguments.');
  }
  const opt = {
    method: 'POST',
    restype: 'json',
  }
  if (len == 1) {
    params = command;
    command = 'command';
  }
  if (len == 2) {
    params = options;
  }
  if (options) {
    if (options.method) opt.method = options.method;
    if (options.restype) opt.restype = options.restype;
  }
  const body = await request({
    uri: `http://localhost:${config.port}/${command}`,
    method: opt.method,
    body: params,
    json: true,
  });
  console.log(body);
  return body;
}

const quiz_master = process.env.QUIZ_MASTER || '_quiz_master_';

var led_mode = 'auto';

talk.dummy = (process.env['SPEECH'] === 'off' && process.env['MACINTOSH'] !== 'on');
talk.macvoice = (process.env['MACINTOSH'] === 'on');

var robotDataPath = process.argv[2] || path.join(HOME, 'robot-data.json');

const m = function() {
  let res = {};
  for (let i = 0; i < arguments.length; ++i) {
    if (arguments[i]) Object.assign(res, arguments[i]);
  }
  return res;
};

try {
var robotJson = fs.readFileSync(robotDataPath);
} catch(err) {
}
if (robotJson) {
  var robotData = JSON.parse(robotJson);
} else {
  var robotData = {};
}
if (typeof robotData.quizAnswers === 'undefined') robotData.quizAnswers = {};
if (typeof robotData.quizEntry === 'undefined') robotData.quizEntry = {};
if (typeof robotData.quizPayload === 'undefined') robotData.quizPayload = {};
if (typeof robotData.quizList === 'undefined') robotData.quizList = {};

let { students } = utils.attendance.load(null, path.join(HOME, 'quiz-student.txt'), null);

var saveDelay = false;
var savedData = null;
var saveWFlag = false;
var quizAnswersCache = {};

function writeRobotData() {
  saveWFlag = true;
  if (!saveDelay) {
    const save = () => {
      if (saveWFlag) {
        saveWFlag = false;
        saveDelay = true;
        const data = JSON.stringify(robotData, null, '  ');
        if (savedData == null || savedData !== data) {
          savedData = data;
          try {
            console.log(`write ${robotDataPath}`);
            fs.writeFile(robotDataPath, data, () => {
              setTimeout(() => {
                save();
              }, saveInterval);
            });
            return;
          } catch(err) {
            console.error(err);
          }
        }
      }
      saveDelay = false;
    }
    save();
  }
}

function chat(message, tone, callback) {
  var dt = new Date();
  var sendTime = dt.toFormat("YYYY-MM-DD HH24:MI:SS");
  var recvTime = "1970-01-01 00:00:00";

  fs.readFile('./last_chat.txt', 'utf8', function (err, data) {
    if (err) {

    }
    if (data != undefined) {
      recvTime = data;
    }

    const json = {
      language: "ja-JP",
      botId: "Chatting",
      appId: APPID,
      voiceText: message,
      clientData: {
        option: {
          t: '',
        },
      },
      appRecvTime: recvTime,
      appSendTime: sendTime,
    }

    if (tone) {
      json.clientData.option.t = tone;
    }

    request({
      method: 'POST',
      url:'https://api.apigw.smt.docomo.ne.jp/naturalChatting/v1/dialogue?APIKEY='+APIKEY,
      json,
    }).then((body) => {
      callback(null, body);
      fs.writeFile('./last_chat.txt', body.serverSendTime, function (err) {
        if (err) {
          throw err;
        }
      });
    }).catch((err) => {
      callback(err, null);
    })
  });
}

speech.recording = false;

var last_led_action = 'led-off';

const gpioSocket = (function() {
  const io = require('socket.io-client');
  return io(`http://localhost:${config.gpio_port}`);
})();

function servoAction(action, payload, callback) {
  if (process.env['SPEECH'] === 'off') {
    if (callback) callback();
    return;
  }
  let done = false;
  gpioSocket.emit('message', { action, ...payload, }, (payload) => {
    if (done) return;
    done = true;
    console.log(payload);
    if (callback) callback();
  });
  if (callback) {
    setTimeout(() => {
      if (done) return;
      done = true;
      if (callback) callback();
    }, 3000);
  }
}

talk.on('idle', function() {
	//speech.recording = true;
});

talk.on('talk', function() {
	speech.recording = false;
});

speech.on('data', function(data) {
  console.log(data);
});

const app = express()

app.use((req, res, next) => {
  console.log(`# ${(new Date()).toLocaleString()} ${req.ip} ${req.url}`);
  next();
});

app.use(bodyParser.json({ type: 'application/json' }))
app.use(bodyParser.raw({ type: 'application/*' }))

app.use(express.static('public'))
app.use('/images', express.static(PICT))

function docomo_chat(payload, callback) {
  if (payload.tone == 'kansai_dialect') {
    var tone = "kansai";
  } else if (payload.tone == 'baby_talk_japanese') {
    var tone = "akachan";
  } else {
    var tone = "";
  }
	chat(payload.message, tone, function(err, body) {
    var utt = payload.message+'がどうかしましたか。';
    try {
      if (err) {
        console.error(err);
        if (callback) callback(err, 'エラー');
        return;
      } else {
        utt = body.systemText.expression;
      }
      if (payload.silence) {
        if (callback) callback(err, utt);
      } else {
        if (led_mode == 'auto') {
          servoAction('led-off');
          last_led_action = 'led-off';
        }
        servoAction('centering', { direction: payload.direction, }, () => {
          servoAction('talk', {}, () => {
            talk.voice = payload.voice;
            talk.play(utt, {
              speed: payload.speed,
              volume: payload.volume,
              voice: payload.voice,
            }, () => {
              // if (led_mode == 'auto') {
              //   servoAction('led-on');
              // }
              servoAction('idle');
              if (callback) callback(err, utt);
            });
          });
        })
      }
    } catch(err) {
      console.error(err);
      if (callback) callback(err, '');
    }
	})
}

var playing = false;

function text_to_speech(payload, callback) {
  if (!playing) {
    if (payload.silence) {
      if (callback) callback();
    } else {
      playing = true;
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
      servoAction('centering', { direction: payload.direction, }, () => {
        servoAction('talk', {}, () => {
          talk.play(payload.message, {
            speed: payload.speed,
            volume: payload.volume,
            voice: payload.voice,
          }, () => {
            // if (led_mode == 'auto') {
            //   servoAction('led-on');
            // }
            servoAction('idle');
            playing = false;
            if (callback) callback();
          });
        });
      });
    }
  } else {
    if (callback) callback();
  }
}

function speech_to_text(payload, callback) {
  var done = false;

  led_mode = 'auto';

  var threshold = payload.threshold;
  speech.emit('mic_threshold', threshold.toString());

  function removeListener() {
    buttonClient.removeListener('button', listenerButton);
    speech.removeListener('data', listener);
    speech.removeListener('speech', speechListener);
    speech.removeListener('button', buttonListener);
    speech.removeListener('camera', cameraListener);
  }

  if (payload.timeout != 0) {
    setTimeout(() => {
      if (!done) {
        speech.recording = false;
        removeListener();
        if (callback) callback(null, '[timeout]');
        if (led_mode == 'auto') {
          servoAction('led-off');
          last_led_action = 'led-off';
        }
      }
      done = true;
    }, payload.timeout);

    speech.recording = true;
  }

  function listener(data) {
    if (!done) {
      speech.recording = false;
      removeListener();
      if (callback) callback(null, data);
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
    }
    done = true;
  }

  function speechListener(data) {
    if (!done) {
      var retval = {
        speechRequest: true,
        payload: data,
      }
      speech.recording = false;
      removeListener();
      if (callback) callback(null, retval);
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
    }
    done = true;
  }

  function buttonListener(state) {
    if (state) {
      if (!done) {
        speech.recording = false;
        removeListener();
        if (callback) callback(null, '[canceled]');
        if (led_mode == 'auto') {
          servoAction('led-off');
          last_led_action = 'led-off';
        }
      }
      done = true;
    }
  }

  function listenerButton(data) {
    if (!done) {
      data.button = true;
      removeListener();
      if (callback) callback(null, data);
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
    }
    done = true;
  }

  function cameraListener(data) {
    if (!done) {
      removeListener();
      if (callback) callback(null, '[camera]');
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
    }
    done = true;
  }

  if (led_mode == 'auto') {
    if (payload.timeout > 0) {
        servoAction('led-on');
        last_led_action = 'led-on';
    } else {
        servoAction('led-off');
        last_led_action = 'led-off';
    }
  }

  buttonClient.on('button', listenerButton);
  speech.on('data', listener);
  speech.on('speech', speechListener);
  speech.on('button', buttonListener);
  speech.on('camera', cameraListener);
}

function quiz_button(payload, callback) {
  var done = false;

  if (payload.timeout != 0) {
    setTimeout(() => {
      if (!done) {
        if (callback) callback(null, '[timeout]');
        buttonClient.removeListener('button', listener);
      }
      done = true;
    }, payload.timeout);
  }

  function listener(data) {
    if (!done) {
      if (callback) callback(null, data);
      buttonClient.removeListener('button', listener);
    }
    done = true;
  }

  buttonClient.on('button', listener);
}

app.post('/docomo-chat', (req, res) => {
  console.log('/docomo-chat');
  console.log(req.body);

  docomo_chat({
    message: req.body.message,
    speed: req.body.speed || null,
    volume: req.body.volume || null,
    tone: req.body.tone || null,
    direction: req.body.direction || null,
    voice: req.body.voice || null,
    silence: req.body.silence || null,
  }, (err, data) => {
    res.send(data);
  });
});

app.post('/text-to-speech', (req, res) => {
  console.log('/text-to-speech');
  console.log(req.body);

  text_to_speech({
    message: req.body.message,
    speed: req.body.speed || null,
    volume: req.body.volume || null,
    direction: req.body.direction || null,
    voice: req.body.voice || null,
    silence: req.body.silence || null,
  }, (err) => {
    res.send('OK');
  });
});

app.post('/speech-to-text', (req, res) => {
  console.log('/speech-to-text');
  console.log(req.body);

  speech_to_text({
    timeout: (typeof req.body.payload.timeout === 'undefined') ? 30000 : req.body.payload.timeout,
    threshold: (typeof req.body.payload.sensitivity === 'undefined') ? 2000 : req.body.payload.sensitivity,
  }, (err, data) => {
    res.send(data);
  });
});

/*
  speech-to-textノードのデバッグ用
  Google Speech API に問い合わせないで curl コマンドでメッセージを送信できる

  curlコマンド使用例
  $ curl -X POST --data 'こんにちは' http://192.168.X.X:3090/debug-speech
*/
app.post('/debug-speech', (req, res) => {
  speech.emit('data', req.body.toString('utf-8'));
  res.send('OK');
});

app.post('/speech', (req, res) => {
  speech.emit('speech', req.body.toString('utf-8'));
  res.send('OK');
});

/*
  マイクによる音声認識の閾値を変更する
  閾値が0に近い程マイクの感度は高くなる

  curlコマンド使用例
  $ curl -X POST --data '200' http://192.168.X.X:3090/mic-threshold
*/
app.post('/mic-threshold', (req, res) => {
  speech.emit('mic_threshold', req.body.toString('utf-8'));
  res.send('OK');
})

app.get('/health', (req, res) => {
  res.send(`${(new Date()).toLocaleString()}`);
});

function changeLed(payload) {
  if (payload.action === 'auto') {
    led_mode = 'auto';
  }
  if (payload.action === 'off') {
    led_mode = 'manual';
    servoAction('led-off');
    last_led_action = 'led-off';
  }
  if (payload.action === 'on') {
    led_mode = 'manual';
    servoAction('led-on');
    last_led_action = 'led-on';
  }
  if (payload.action === 'blink') {
    led_mode = 'manual';
    servoAction('led-blink');
    last_led_action = 'led-blink';
  }
}

let _playone = null;

function execSoundCommand(payload) {
  const sound = (typeof payload.play !== 'undefined') ? payload.play : payload.sound;
  if (sound === 'stop') {
    if (_playone) {
      utils.kill(_playone.pid,'SIGTERM',function() {
      });
      _playone = null;
    }
  } else
  if (typeof sound !== 'undefined') {
    const base = path.join(HOME, 'Sound');
    const p = path.normalize(path.join(base, sound));
    if (p.indexOf(base) == 0) {
      const cmd = (process.platform === 'darwin') ? 'afplay' : 'aplay';
      const opt = (process.platform === 'darwin') ? [p] : ['-Dplug:softvol', p];
      console.log(`/usr/bin/${cmd} ${p}`);
      _playone = spawn(`/usr/bin/${cmd}`, opt);
      _playone.on('close', function(code) {
        console.log('close', code);
      });
    }
  }
}

async function quizPacket(payload) {
  // if (payload.action === 'result') {
  //   payload.result = quizAnswers[payload.question];
  // }
  if (payload.action === 'entry') {
    payload.entry = Object.keys(robotData.quizEntry).map( key => {
      return {
        clientId: robotData.quizEntry[key].clientId,
        name: robotData.quizEntry[key].name,
      }
    }).filter( v => v.name != quiz_master );
    //payload.name = quiz_master;
  }
  if (payload.action === 'quiz-entry-init') {
    robotData.quizEntry = {};
    writeRobotData();
    const result = await quizPacket({
      action: 'entry',
      name: quiz_master,
    });
    io.emit('quiz', result);
    setTimeout(() => {
      io.emit('quiz-reload-entry');
    }, 3000);
    return result;
  }
  if (payload.action === 'quiz-init') {
    //クイズデータの保存
    if (USE_DB) {
      const startTime = new Date();
      if (payload.quizId) {
        if (payload.pages) {
          for (var i=0;i<payload.pages.length;i++) {
            const page = payload.pages[i];
            if (page.action == 'quiz' && page.question) {
              const a = {
                quizId: payload.quizId,
                quizTitle: page.question,
                quizOrder: i,
                choices: page.choices,
                answers: page.answers,
                startTime,
              }
              if (payload.quizName) {
                a.quizName = payload.quizName;
              }
              db.update('updateQuiz', a);
            }
          }
        }
      }
      payload.quizStartTime = startTime;
    }
    {
      if (payload.quizId) {
        if (!robotData.quizList) {
          robotData.quizList = {};
        }
        if (!robotData.quizList[payload.quizId]) {
          robotData.quizList[payload.quizId] = {}
        }
        if (payload.quizName) {
          robotData.quizList[payload.quizId].name = payload.quizName;
        }
        if (payload.pages) {
          if (!robotData.quizList[payload.quizId].quiz) {
            robotData.quizList[payload.quizId].quiz = {}
          }
          payload.pages.forEach( page => {
            if (page.action == 'quiz' && page.question) {
              robotData.quizList[payload.quizId].quiz[page.question] = {
                choices: page.choices,
                answers: page.answers,
              }
            }
          })
        }
        if (!USE_DB) {
          writeRobotData();
        }
      }
      if (!USE_DB) {
        payload.quizStartTime = new Date();
      }
    }
  }
  if (payload.action === 'quiz-show') {
    //クイズの表示
    payload.action = 'quiz-init';
  }
  if (payload.action === 'quiz-ranking') {
    if (USE_DB) {
      if (typeof payload.quizId !== 'undefined') {
        const { answers } = await db.findAnswers({ quizId: payload.quizId, startTime: payload.quizStartTime });
        //ゲストプレイヤーはランキングから外す
        const ret = {};
        if (answers) {
          Object.keys(answers).forEach( quizTitle => {
            const players = answers[quizTitle];
            ret[quizTitle] = {}
            if (players) {
              Object.keys(players).forEach( clientId => {
                const player = players[clientId];
                if (player.name.indexOf('ゲスト') != 0
                && player.name.indexOf('guest') != 0
                && player.name.indexOf('学生講師') != 0) {
                  ret[quizTitle][clientId] = {
                      name: player.name,
                      answer: player.answer,
                      time: player.time,
                  }
                }
              });
            }
          });
        }
        payload.quizAnswers = ret;
      } else {
        payload.quizAnswers = await db.answerAll();
      }
    } else {
      if (typeof payload.quizId !== 'undefined') {
        payload.quizAnswers = robotData.quizAnswers[payload.quizId];
        //ゲストプレイヤーはランキングから外す
        const ret = {};
        if (payload.quizAnswers) {
          Object.keys(payload.quizAnswers).forEach( quizId => {
            const players = payload.quizAnswers[quizId];
            ret[quizId] = {}
            if (players) {
              Object.keys(players).forEach( clientId => {
                const player = players[clientId];
                if (player.quizStartTime === payload.quizStartTime) {
                  if (player.name.indexOf('ゲスト') != 0
                  && player.name.indexOf('guest') != 0
                  && player.name.indexOf('学生講師') != 0) {
                    ret[quizId][clientId] = {
                        name: player.name,
                        answer: player.answer,
                        time: player.time,
                    }
                  }
                }
              });
            }
          });
        }
        payload.quizAnswers = ret;
      } else {
        payload.quizAnswers = robotData.quizAnswers;
      }
    }
    payload.name = quiz_master;
  }
  if (payload.members) {
    payload.members = students.map( v => v.name );
  }
  return payload;
}

function storeQuizPayload(payload)
{
  if (payload.name !== quiz_master) {
    robotData.quizPayload['others'] = m(robotData.quizPayload['others'], payload);
  }
  robotData.quizPayload[quiz_master] = m(robotData.quizPayload[quiz_master], payload);
  writeRobotData();
}

function loadQuizPayload(payload)
{
  if (payload.name == quiz_master) {
    var val = robotData.quizPayload[quiz_master] || {};
  } else {
    var val = robotData.quizPayload['others'] || {};
  }
  val.members = students.map( v => v.name );
  return m(val, { initializeLoad: true, });
}

app.post('/result', async (req, res) => {
  if (req.body.type === 'answers') {
    if (req.body.quizId) {
      if (req.body.startTime) {
        const showSum = (typeof req.body.showSum === 'undefined' || !req.body.showSum) ? false : true;
        //スタート時間が同じものだけを返す
        if (USE_DB) {
          if (showSum) {
            const result = {};
            const quizAnswers = quizAnswersCache[req.body.quizId];
            Object.keys(quizAnswers).map( quiz => {
              const qq = quizAnswers[quiz];
              const tt = {};
              Object.keys(qq).forEach( clientId => {
                const answer = qq[clientId];
                if (answer.quizStartTime === req.body.startTime) {
                  tt[clientId] = answer;
                }
              });
              if (Object.keys(tt).length > 0) {
                result[quiz] = tt;
              }
            });
            const question = (robotData.quizList) ? robotData.quizList[req.body.quizId] : null;
            res.send({ answers: result, question: question });
          } else {
            const retval = await db.findAnswers({ quizId: req.body.quizId, startTime: req.body.startTime });
            res.send(retval);
          }
        } else {
          const result = {};
          const quizAnswers = robotData.quizAnswers[req.body.quizId];
          Object.keys(quizAnswers).map( quiz => {
            const qq = quizAnswers[quiz];
            const tt = {};
            Object.keys(qq).forEach( clientId => {
              const answer = qq[clientId];
              if (answer.quizStartTime === req.body.startTime) {
                tt[clientId] = answer;
              }
            });
            if (Object.keys(tt).length > 0) {
              result[quiz] = tt;
            }
          });
          const question = (robotData.quizList) ? robotData.quizList[req.body.quizId] : null;
          res.send({ answers: result, question: question });
        }
      } else {
        //スタート時間のリストを返す
        if (USE_DB) {
          const retval = await db.startTimeList({ quizId: req.body.quizId })
          res.send(retval);
        } else {
          const quizAnswers = robotData.quizAnswers[req.body.quizId];
          const result = {};
          Object.keys(quizAnswers).map( quiz => {
            const qq = quizAnswers[quiz];
            Object.keys(qq).forEach( clientId => {
              result[qq[clientId].quizStartTime] = true;
            })
          })
          res.send({ startTimes: Object.keys(result) });
        }
      }
    } else {
      //クイズIDを返す
      if (USE_DB) {
        const list = await db.quizIdList();
        res.send(list)
      } else {
        const list = { quizIds: Object.keys(robotData.quizAnswers)};
        res.send(list)
      }
    }
    return;
  }
  res.send({ status: 'OK' });
})

app.post('/command', async (req, res) => {
  if (req.body.type === 'quiz') {
    const payload = await quizPacket(req.body);
    storeQuizPayload(payload);
    io.emit('quiz', payload);
    if (req.body.action == 'quiz-ranking') {
      res.send(payload.quizAnswers);
      return;
    }
    if (req.body.action === 'quiz-init') {
      res.send(payload.quizStartTime);
      return;
    }
  }
  if (req.body.type === 'led') {
    changeLed(req.body);
  }
  if (req.body.type === 'button') {
    buttonClient.doCommand(req.body);
  }
  if (req.body.type === 'movie') {
    if (playerSocket) {
      playerSocket.emit('movie', req.body, (data) => {
        res.send(data);
      });
      return;
    } else {
      res.send({ state: 'none' });
      return;
    }
  }
  if (req.body.type === 'sound') {
    execSoundCommand(req.body);
  }
  if (req.body.type === 'scenario') {
    const { action } = req.body;
    if (action == 'play') {
      dora.stop();
      function emitError(err) {
        console.log(err);
        console.log(dora.errorInfo());
        err.info = dora.errorInfo();
        if (!err.info.reason) {
          err.info.reason = err.toString();
        }
        io.emit('scenario_status', {
          err: err.toString(),
          lineNumber: err.info.lineNumber,
          code: err.info.code,
          reason: err.info.reason,
        });
      }
      try {
        const { filename, range, name } = req.body;
        const base = path.join(HOME, 'Documents');
        const username = (name) ? path.basename(name) : null;
        fs.readFile(path.join(base, username, filename), (err, data) => {
          if (err) {
            emitError(err);
            return;
          }
          dora.parse(data.toString(), function (filename, callback) {
            fs.readFile(path.join(base, username, filename), (err, data) => {
              if (err) {
                emitError(err);
                return;
              }
              callback(data.toString());
            });
          }).then(()=> {
            dora.play({}, {
              socket: localSocket,
              range,
            }, (err, msg) => {
              if (err) {
                emitError(err);
                console.log(`${err.info.lineNumber}行目でエラーが発生しました。\n\n${err.info.code}\n\n${err.info.reason}`);
              } else {
                io.emit('scenario_status', {
                  message: msg,
                });
                console.log(msg);
              }
            });
          }).catch((err) => {
            emitError(err);
          });
        });
      } catch(err) {
        emitError(err);
      }
    }
    if (action == 'stop') {
      dora.stop();
      //talk.stop();
      //servoAction('idle');
      execSoundCommand({ sound: 'stop' });
      buttonClient.emit('stop-speech-to-text');
      buttonClient.emit('all-blink', {});
      speech.emit('data', 'stoped');
      if (playerSocket) {
        playerSocket.emit('movie', { action: 'cancel', }, (data) => {
        });
      }
    }
  }
  res.send({ status: 'OK' });
})

app.post('/scenario', (req, res) => {
  const base = path.join(HOME, 'Documents');
  const username = (req.body.name) ? path.basename(req.body.name) : null;
  const filename = (req.body.filename) ? path.basename(req.body.filename) : null;
  if (username === 'admin-user') {
    if (req.body.action == 'save') {
      if (filename === '生徒リスト') {
        if (typeof req.body.text !== 'undefined') {
          if (filename) {
            mkdirp(HOME, function(err) {
              fs.writeFile(path.join(HOME, 'quiz-student.txt'), req.body.text, (err) => {
                let r = utils.attendance.load(null, path.join(HOME, 'quiz-student.txt'), null);
                if (typeof r.students !== 'undefined') students = r.students;
                res.send({ status: (!err) ? 'OK' : err.code, });
              });
            });
          } else {
            res.send({ status: 'Not found filename', });
          }
        } else {
          res.send({ status: 'No data', });
        }
      } else if (filename === '出席CSV') {
        res.send({ status: 'OK' });
      } else if (filename === '日付リスト') {
        if (typeof req.body.text !== 'undefined') {
          if (filename) {
            mkdirp(HOME, function(err) {
              fs.writeFile(path.join(HOME, 'date-list.txt'), req.body.text, (err) => {
                res.send({ status: (!err) ? 'OK' : err.code, });
              });
            });
          } else {
            res.send({ status: 'Not found filename', });
          }
        } else {
          res.send({ status: 'No data', });
        }
      } else {
        res.send({ status: 'OK' });
      }
    } else
    if (req.body.action == 'load') {
      if (filename === '生徒リスト') {
        fs.readFile(path.join(HOME, 'quiz-student.txt'), (err, data) => {
          res.send({ status: (!err) ? 'OK' : err.code, text: (data) ? data.toString() : '', });
        });
      } else if (filename === '出席CSV') {
        const { dates, students } = utils.attendance.load(null, path.join(HOME, 'quiz-student.txt'), path.join(HOME, 'date-list.txt'));
        if (USE_DB) {
          db.loadAttendance(dates).then( robotData => {
            res.send({ status: 'OK', text: utils.attendance.csv(robotData, dates,  students)});
          });
        } else {
          res.send({ status: 'OK', text: utils.attendance.csv(robotData, dates,  students)});
        }
      } else if (filename === '日付リスト') {
        fs.readFile(path.join(HOME, 'date-list.txt'), (err, data) => {
          res.send({ status: (!err) ? 'OK' : err.code, text: (data) ? data.toString() : '', });
        });
      } else {
        res.send({ status: 'OK' });
      }
    } else {
      res.send({ status: 'OK' });
    }
  } else
  if (students.some( m => m.name === username ) || config.free_editor)
  {
    if (req.body.action == 'save') {
      if (typeof req.body.text !== 'undefined') {
        if (filename) {
          mkdirp(path.join(base, username), function(err) {
            fs.writeFile(path.join(base, username, filename), req.body.text, (err) => {
              res.send({ status: (!err) ? 'OK' : err.code, });
            });
          });
        } else {
          res.send({ status: 'Not found filename', });
        }
      } else {
        res.send({ status: 'No data', });
      }
    } else
    if (req.body.action == 'load') {
      if (filename) {
        mkdirp(path.join(base, username), function(err) {
          fs.readFile(path.join(base, username, filename), (err, data) => {
            res.send({ status: (!err) ? 'OK' : err.code, text: (data) ? data.toString() : '', });
          });
        });
      } else {
        res.send({ status: 'Not found filename', });
      }
    } else
    if (req.body.action == 'list') {
      mkdirp(path.join(base, username), function(err) {
        fs.readdir(path.join(base, username), (err, items) => {
          res.send({ status: (!err) ? 'OK' : err.code, items: items.filter( v => v.indexOf('.') !== 0 ), });
        });
      });
    } else {
      res.send({ status: 'OK' });
    }
  } else {
    res.send({ status: `No name: ${username}` });
  }
})

const camera = new (require('./robot-camera'))();

camera.on('change', (payload) => {
  console.log('camera changed');
  speech.emit('camera', payload);
});

/*
  カメラ連携

  curlコマンド使用例
  $ curl -X POST --data '[{"id":100, "area":200}]' --header "content-type:application/json" http://localhost:3090/camera
*/
app.post('/camera', (req, res) => {
  camera.up(req.body);
  res.send({ status: 'OK' });
});

const server = require('http').Server(app);
const io = require('socket.io')(server);

const iop = io.of('player');
var playerSocket = null;

const quiz_masters = {};
const imageServers = {};

iop.on('connection', function (socket) {
  console.log('connected iop', socket.conn.remoteAddress);
  playerSocket = socket;
  socket.on('disconnect', function () {
    playerSocket = null;
    console.log('disconnect iop');
    delete imageServers[socket.id];
    io.emit('imageServers', imageServers);
  });
  socket.on('notify', function(data) {
    const ip = socket.conn.remoteAddress.match(/^::ffff:(.+)$/);
    if (ip != null && data.role === 'imageServer') {
      data.host = ip[1];
      console.log(data);
      imageServers[socket.id] = data;
      io.emit('imageServers', imageServers);
    }
  });
});

io.on('connection', function (socket) {
  console.log('connected io', socket.conn.remoteAddress);
  socket.on('disconnect', function () {
    speech.recording = false;
    console.log('disconnect');
    delete quiz_masters[socket.id];
    console.log(Object.keys(quiz_masters));
  });
  socket.on('docomo-chat', function (payload, callback) {
    try {
      docomo_chat({
        message: payload.message,
        speed: payload.speed || null,
        volume: payload.volume || null,
        tone: payload.tone || null,
        direction: payload.direction || null,
        voice: payload.voice || null,
        silence: payload.silence || null,
      }, (err, data) => {
        if (callback) callback(data);
      });
    } catch(err) {
      console.error(err);
    }
  });
  socket.on('text-to-speech', function (payload, callback) {
    try {
      text_to_speech({
        message: payload.message,
        speed: payload.speed || null,
        volume: payload.volume || null,
        direction: payload.direction || null,
        voice: payload.voice || null,
        silence: payload.silence || null,
      }, (err) => {
        if (callback) callback('OK');
      });
    } catch(err) {
      console.error(err);
    }
  });
  socket.on('stop-text-to-speech', function (payload, callback) {
    talk.flush();
    if (callback) callback('OK');
  });
  socket.on('speech-to-text', function (payload, callback) {
    try {
      speech_to_text({
        timeout: (typeof payload.timeout === 'undefined') ? 30000 : payload.timeout,
        threshold: (typeof payload.sensitivity === 'undefined') ? 2000 : payload.sensitivity,
      }, (err, data) => {
        if (callback) callback(data);
      });
    } catch(err) {
      console.error(err);
    }
  });
  socket.on('stop-speech-to-text', function (payload, callback) {
    speech.emit('data', 'stoped');
    if (callback) callback('OK');
  });
  socket.on('command', function(payload, callback) {
    try {
      const base = path.join(__dirname, 'command');
      const cmd = path.normalize(path.join(base, payload.command));
      const args = payload.args || '';
      if (cmd.indexOf(base) == 0) {
      } else {
        console.log('NG');
        if (callback) callback();
        return;
      }
      exec(`${cmd} ${args}`, (err, stdout, stderr) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log(stdout);
      });
      if (callback) callback();
    } catch(err) {
      console.error(err);
    }
  });
  socket.on('message', function(payload, callback) {
    console.log('message', payload);
    if (callback) callback();
  });
  socket.on('quiz-command', async function(payload, callback) {
    const result = await quizPacket(payload);
    storeQuizPayload(result);
    io.emit('quiz', result);
    if (callback) callback();
  });
  socket.on('led-command', function(payload, callback) {
    changeLed(payload);
    if (callback) callback();
  });
  socket.on('sound-command', (payload, callback) => {
    execSoundCommand(payload);
    if (callback) callback();
  })
  socket.on('button-command', function(payload, callback) {
    buttonClient.doCommand(payload);
    if (callback) callback();
  });
  socket.on('quiz', async function(payload, callback) {
    payload.time = new Date();
    if (typeof payload.question === 'undefined') {
      //参加登録
      if (typeof payload.clientId !== 'undefined') {
        robotData.quizEntry[payload.clientId] = payload;
        console.log(payload.name);
        if (payload.name === quiz_master) {
          quiz_masters[socket.id] = socket;
        }
        writeRobotData();
        const quizPayload = await quizPacket({
          action: 'entry',
          name: quiz_master,
        })
        Object.keys(quiz_masters).forEach( key => {
          quiz_masters[key].emit('quiz', quizPayload);
        });
        socket.emit('quiz', loadQuizPayload(payload));
        socket.emit('imageServers', imageServers);
      }
    } else {
      if (payload.name === quiz_master) return;
      const showSum = (typeof payload.showSum === 'undefined' || !payload.showSum) ? false : true;
      if (USE_DB) {
        if (showSum) {
          const quizId = payload.quizId;
          if (quizAnswersCache[quizId] == null) {
            quizAnswersCache[quizId] = {};
          }
          if (quizAnswersCache[quizId][payload.question] == null) {
            quizAnswersCache[quizId][payload.question] = {};
          }
          const p = { ...payload };
          delete p.question
          delete p.quizId
          quizAnswersCache[quizId][payload.question][payload.clientId] = p;
        }
        const a = {
          quizId: payload.quizId,
          quizTitle: payload.question,
          clientId: payload.clientId,
          username: payload.name,
          answerString: payload.answer,
          time: payload.time,
          startTime: payload.quizStartTime,
        }
        await db.update('updateAnswer', a);
      } else {
        const quizId = payload.quizId;
        if (robotData.quizAnswers[quizId] == null) {
          robotData.quizAnswers[quizId] = {};
        }
        if (robotData.quizAnswers[quizId][payload.question] == null) {
          robotData.quizAnswers[quizId][payload.question] = {};
        }
        const p = { ...payload };
        delete p.question
        delete p.quizId
        robotData.quizAnswers[quizId][payload.question][payload.clientId] = p;
        writeRobotData();
      }
      Object.keys(quiz_masters).forEach( key => {
        quiz_masters[key].emit('quiz', {
          action: 'refresh',
          name: quiz_master,
        });
      });
    }
    if (callback) callback();
  });
  socket.on('quiz-button', function (payload, callback) {
    try {
      quiz_button({
        timeout: (typeof payload.timeout === 'undefined') ? 30000 : payload.timeout,
      }, (err, data) => {
        if (callback) callback(data);
      });
    } catch(err) {
      console.error(err);
    }
  });
  socket.on('stop-quiz-button', function (payload, callback) {
    buttonClient.emit('button', 'stoped');
    if (callback) callback('OK');
  });
});

const startServer = function() {
  if (USE_DB) {
    return RobotDB(`${HOME}/robot-server.db`, {
      operatorsAliases: false,
    }, async (err, db) => {
      server.listen(config.port, () => console.log(`robot-server listening on port ${config.port}!`))
    })
  }
  server.listen(config.port, () => console.log(`robot-server listening on port ${config.port}!`))
  return {}
}

const db = startServer();

var shutdownTimer = null;
var shutdownLEDTimer = null;
var doShutdown = false;

gpioSocket.on('button', (payload) => {
  console.log(payload);
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
  if (shutdownLEDTimer) {
    clearTimeout(shutdownLEDTimer);
    shutdownLEDTimer = null;
  }
  if (payload.state) {
    if (shutdownTimer) clearTimeout(shutdownTimer);
    shutdownTimer = setTimeout(() => {
      gpioSocket.emit('led-command', { action: 'power' });
      //さらに５秒間押し続け
      if (shutdownLEDTimer) {
        clearTimeout(shutdownLEDTimer);
        shutdownLEDTimer = null;
      }
      shutdownLEDTimer = setTimeout(() => {
        gpioSocket.emit('led-command', { action: 'on' });
        //シャットダウン
        doShutdown = true;
        servoAction('stop');
        setTimeout(() => {
          const _playone = spawn('/usr/bin/sudo', ['shutdown', 'now']);
          _playone.on('close', function(code) {
            console.log('shutdown done');
          });
          doShutdown = false;
        }, 5000)
      }, 5*1000);
    }, 5*1000);
  } else {
    if (!doShutdown) {
      if (last_led_action) {
        servoAction(last_led_action);
      }
    }
  }
  if (!doShutdown) {
    speech.emit('button', payload.state);
  }
});

const ioClient = require('socket.io-client');
const localSocket = ioClient(`http://localhost:${config.port}`);

localSocket.on('connect', () => {
  console.log('connected');
});
