const EventEmitter = require('events');
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
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
const buttonClient = require('./button-client')(config);
const RobotDB = require('./robot-db');
const USE_DB = config.useDB;
const saveInterval = 1000;
const URL = require('url');
const googleRouter = require('./google-router');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const passport = require("passport");
const LocalStrategy = require('passport-local').Strategy;
const {
  localhostIPs,
  localIPCheck,
  createSignature,
  localhostToken,
  hasPermission,
  checkPermission,
} = require('./accessCheck');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });
const bcrypt = (() => {
  try { return require('bcrypt'); }
  catch(e) { return equire('bcryptjs'); }
})();
const HOME = (process.platform === 'darwin') ? path.join(process.env.HOME, 'Documents', workFolder) : process.env.HOME;
const PICT = (process.platform === 'darwin') ? path.join(process.env.HOME, 'Pictures', workFolder) : path.join(process.env.HOME, 'Pictures');
const PART_LIST_FILE_PATH = path.join(HOME, 'quiz-student.txt');

const isLogined = function(view) {
  return function (req, res, next) {
    if (!config.credentialAccessControl) {
      return next();
    }
    if (config.allowLocalhostAccess && localIPCheck(req)) {
      return next();
    }
    if (req.isAuthenticated()) {
      return next();
    }
    if (view) {
      res.redirect(`/login/${view}`);
    } else {
      res.statusCode = 401;
      res.end('Unauthorized');
    }
  };
}

function isValidFilename(filename) {
  if (filename) {
    return (path.basename(filename) === filename && path.normalize(filename) === filename);
  }
  return false;
}

function readdirFileOnly(dirname, callback) {
  fs.readdir(dirname, (err, items) => {
    if (err) {
      callback(err, []);
      return;
    }
    const r = [];
    const check = () => {
      if (items.length <= 0) {
        callback(null, r);
        return;
      }
      const t = items.shift();
      fs.stat(path.join(dirname, t), (err, stat) => {
        if (err) {
          callback(err, []);
          return;
        }
        if (stat.isFile()) {
          if (t.indexOf('.') !== 0) {
            r.push(t);
          }
        }
        check();
      });
    }
    check();
  });
}

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
  function connect(node, options) {
    const params = options.split('/');
    if (params.length < 1 || params === '') {
      throw new Error('ホスト名がありません。');
    }
    node.on("input", async function(msg) {
      const host = params[0];
      const name = (params.length > 1) ? params[1] : null;
      const team = (params.length > 2) ? params[2] : null;
      buttonClient.emit('open-slave', { host, name, team, });
      node.send(msg);
    });
  }
  DORA.registerType('connect', connect);

  function close(node, options) {
    const params = options.split('/');
    if (params.length < 1 || params === '') {
      throw new Error('ホスト名がありません。');
    }
    node.on("input", async function(msg) {
      const host = params[0];
      buttonClient.emit('close-slave', { host });
      node.send(msg);
    });
  }
  DORA.registerType('close', close);

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
      if (socket) {
        let message = options;
        if (isTemplated) {
          message = DORA.utils.mustache.render(message, msg);
        }
        socket.emit('sound-command', { sound: message });
      }
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
      if (socket) {
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
            } else
            if (typeof res === 'object') {
              msg.languageCode = res.languageCode,
              msg.confidence = res.confidence;
              msg.payload = res.transcript;
              msg.speechText = msg.payload;
              msg.topicPriority = 0;
              delete msg.speechRequest;
              node.next(msg);
            } else {
              msg.payload = res;
              msg.speechText = msg.payload;
              msg.topicPriority = 0;
              delete msg.speechRequest;
              node.send([null, msg]);
            }
          }
        });
      } else {
        msg.payload = 'timeout';
        node.send([msg, null]);
      }
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
  params.localhostToken = localhostToken();
  const body = await request({
    uri: `http://localhost:${config.port}/${command}`,
    method: opt.method,
    json: params,
  });
  console.log(body);
  return body;
}

const quiz_master = process.env.QUIZ_MASTER || '_quiz_master_';

let led_mode = 'auto';
let mode_slave = false;

talk.dummy = (process.env['SPEECH'] === 'off' && process.env['MACINTOSH'] !== 'on');
talk.macvoice = (process.env['MACINTOSH'] === 'on');

let robotDataPath = process.argv[2] || path.join(HOME, 'robot-data.json');

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
if (typeof robotData.recordingTime !== 'undefined') speech.recordingTime = parseInt(robotData.recordingTime);

let { students } = utils.attendance.load(null, PART_LIST_FILE_PATH, null);

let saveDelay = false;
let savedData = null;
let saveWFlag = false;
let quizAnswersCache = {};

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
    appRecvTime: (robotData.chatRecvTime ?  robotData.chatRecvTime : sendTime),
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
    robotData.chatRecvTime = body.serverSendTime;
    writeRobotData();
  }).catch((err) => {
    callback(err, null);
  })
}

speech.recording = false;

var last_led_action = 'led-off';

const gpioSocket = (function() {
  const io = require('socket.io-client');
  return io(`http://localhost:${config.gpioPort}`);
})();

function servoAction(action, payload, callback) {
  if (process.env['SPEECH'] === 'off') {
    if (callback) callback();
    return;
  }
  if (!gpioSocket.connected) {
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
  console.log(`${JSON.stringify(req.headers)}`);
  next();
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({ type: 'application/json' }))
app.use(bodyParser.raw({ type: 'application/*' }))

app.use(cookieParser())

app.use('/images', express.static(PICT))

const sessionStore = new MemoryStore();
app.use(session({
  store: sessionStore,
  secret: config.sessionSecret,
  resave: false,
  proxy: true,
  // cookie: {
  //   maxAge: 10*365*24*60*60*1000,
  // },
  saveUninitialized: false,
}));

app.use((req, res, next) => {
  console.log("SessionID: " + req.sessionID);
  console.log("session: " + JSON.stringify(req.session));
  next();
});

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null,user);
});

passport.use('local', new LocalStrategy({
  passReqToCallback : true
},
function(req, name, password, done) {
console.log(`name:${name} password:${password}`);
  setTimeout(function() {
    let auth = {};
    const checkPass = () => {
      return config.adminAuth.some( a => {
        if (name === a.username && bcrypt.compareSync(password, a.password)) {
          auth = a;
          return true;
        }
        return false;
      })
    }
    if (checkPass()) {
      done(null,{ id: name, authInfo: { scope: auth.permissions, }, timestamp: new Date(), });
    } else {
      done(null,false, { message: 'Incorrect password.' });
    }
  },1000);
}));

passport.use('guest-client', new LocalStrategy({
  passReqToCallback : true
},
function(req, name, password, done) {
  setTimeout(function() {
    let auth = {};
    const checkPass = () => {
      return config.adminAuth.some( a => {
        if (a.guest) {
          if (name === a.username && bcrypt.compareSync(password, a.password)) {
            auth = a;
            return true;
          }
        }
        return false;
      })
    }
    if (checkPass()) {
      done(null,{ id: name, authInfo: { scope: auth.permissions, }, timestamp: new Date(), });
    } else {
console.log('Incorrect password');
      done(null,false, { message: 'Incorrect password.' });
    }
  },1000);
}));

app.get('/admin-page', isLogined('admin'), function(req,res,next) {
  fs.createReadStream(path.join(__dirname,'public/admin-page/index.html')).pipe(res);
});

app.get('/scenario-editor', isLogined('editor'), function(req,res,next) {
  fs.createReadStream(path.join(__dirname,'public/scenario-editor/index.html')).pipe(res);
});

app.use((req, res, next) => {
  if (config.credentialAccessControl) {
    if (config.allowLocalhostAccess && localIPCheck(req)) {
      return next();
    }
    if (req.url.indexOf('/admin-page') === 0) {
      if (!req.isAuthenticated()) {
        return res.redirect('/login/admin');
      }
    }
    if (req.url.indexOf('/scenario-editor') === 0) {
      if (!req.isAuthenticated()) {
        return res.redirect('/login/editor');
      }
    }
  }
  return next();
}, express.static('public'))

app.get('/login/:view', csrfProtection, function(req, res, next) {
  res.render(`login-${req.params.view}`, { csrfToken: req.csrfToken() });
});

app.post('/login/:view', csrfProtection, function(req, res, next) {
  passport.authenticate('local', {
    successRedirect: (req.params.view=='admin')?'/admin-page':'/scenario-editor',
    failureRedirect: `/login/${req.params.view}`,
  })(req, res, next);
});

app.post('/login-quiz-player', function(req, res, next) {
  if (req.isAuthenticated()) {
    res.send('OK\n');
    return;
  }
  req.body.username = 'player';
  req.body.password = 'playernopass';
  passport.authenticate('guest-client', (err, user, info) => {
    if (err) {
      res.statusCode = 401;
      res.end('Unauthorized');
    } else {
      req.logIn(user, {}, function(err) {
        if (err) { return next(err); }
        res.send('OK\n');
      });
    }
  })(req, res, next);
});

app.post('/login-guest-client', function(req, res, next) {
  const { username } = req.body;
  passport.authenticate('guest-client', (err, user, info) => {
    if (err) {
      res.statusCode = 401;
      res.end('Unauthorized');
    } else {
      req.logIn(user, {}, function(err) {
        if (err) { return next(err); }
        createSignature(username, (signature) => {
          res.send({
            user_id: username,
            signature,
          });
        });
      });
    }
  })(req, res, next);
});

app.post('/access-token', isLogined(), function(req, res) {
  createSignature(req.user.id, (signature) => {
    res.json({ user_id: req.user.id, signature });
  })
});

app.get('/logout/:view',function(req,res) {
  req.logout();
  res.redirect(`/login/${req.params.view}`);
});

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
              ...payload,
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
            ...payload,
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
  let done = false;

  //led_mode = 'auto';

  const threshold = payload.threshold;
  const languageCode = payload.languageCode;

  const stopRecording = () => {
    speech.recording = false;
    speech.emit('stopRecording');
    robotData.recordingTime = speech.recordingTime;
    writeRobotData()
  }

  const startRecording = () => {
    speech.recording = true;
    speech.emit('startRecording', {
      threshold,
      languageCode,
    });
  }

  const removeListener = () => {
    buttonClient.removeListener('button', listenerButton);
    speech.removeListener('data', dataListener);
    speech.removeListener('speech', speechListener);
    speech.removeListener('button', buttonListener);
    speech.removeListener('camera', cameraListener);
  }

  if (payload.timeout != 0) {
    setTimeout(() => {
      if (!done) {
        stopRecording();
        removeListener();
        if (callback) callback(null, '[timeout]');
        if (led_mode == 'auto') {
          servoAction('led-off');
          last_led_action = 'led-off';
        }
      }
      done = true;
    }, payload.timeout);

    if (payload.recording) {
      startRecording();
    }
  }

  const dataListener = (data) => {
    if (!done) {
      stopRecording();
      removeListener();
      if (callback) callback(null, data);
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
    }
    done = true;
  }

  const speechListener = (data) => {
    if (!done) {
      var retval = {
        speechRequest: true,
        payload: data,
      }
      stopRecording();
      removeListener();
      if (callback) callback(null, retval);
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
    }
    done = true;
  }

  const buttonListener = (state) => {
    if (state) {
      if (!done) {
        stopRecording();
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

  const listenerButton = (data) => {
    if (!done) {
      data.button = true;
      stopRecording();
      removeListener();
      if (callback) callback(null, data);
      if (led_mode == 'auto') {
        servoAction('led-off');
        last_led_action = 'led-off';
      }
    }
    done = true;
  }

  const cameraListener = (data) => {
    if (!done) {
      stopRecording();
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
    if (payload.timeout > 0 && payload.recording) {
        servoAction('led-on');
        last_led_action = 'led-on';
    } else {
        servoAction('led-off');
        last_led_action = 'led-off';
    }
  }

  buttonClient.on('button', listenerButton);
  speech.on('data', dataListener);
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

app.get('/health', (req, res) => {
  res.send(`${(new Date()).toLocaleString()}`);
});

app.get('/recordingTime', (req, res) => {
  res.send(`${speech.recordingTime}`);
});

app.post('/docomo-chat', hasPermission('control.write'), (req, res) => {
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

app.post('/text-to-speech', hasPermission('control.write'), (req, res) => {
  console.log('/text-to-speech');
  console.log(req.body);

  text_to_speech({
    ...req.body,
  }, (err) => {
    res.send('OK');
  });
});

app.post('/speech-to-text', hasPermission('control.write'), (req, res) => {
  console.log('/speech-to-text');
  console.log(req.body);

  speech_to_text({
    timeout: (typeof req.body.payload.timeout === 'undefined') ? 30000 : req.body.payload.timeout,
    threshold: (typeof req.body.payload.sensitivity === 'undefined') ? 2000 : req.body.payload.sensitivity,
    languageCode: (typeof req.body.payload.languageCode === 'undefined') ? 'ja-JP' : req.body.payload.languageCode,
    recording: (typeof req.body.payload.recording === 'undefined') ? true : req.body.payload.recording,
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
app.post('/debug-speech', hasPermission('control.write'), (req, res) => {
  speech.emit('data', req.body.toString('utf-8'));
  res.send('OK');
});

app.post('/speech', hasPermission('control.write'), (req, res) => {
  speech.emit('speech', req.body.toString('utf-8'));
  res.send('OK');
});

/*
  マイクによる音声認識の閾値を変更する
  閾値が0に近い程マイクの感度は高くなる

  curlコマンド使用例
  $ curl -X POST --data '200' http://192.168.X.X:3090/mic-threshold
*/
app.post('/mic-threshold', hasPermission('control.write'), (req, res) => {
  speech.emit('mic_threshold', req.body.toString('utf-8'));
  res.send('OK');
})

app.use('/google', hasPermission('control.write'), googleRouter);

function changeLed(payload) {
  if (mode_slave) {
    gpioSocket.emit('led-command', payload);
  } else {
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

app.post('/result', hasPermission('result.read'), async (req, res) => {
  if (req.body.type === 'answers') {
    if (req.body.quizId) {
      if (req.body.startTime) {
        const showSum = (typeof req.body.showSum === 'undefined' || !req.body.showSum) ? false : true;
        //スタート時間が同じものだけを返す
        if (USE_DB) {
          if (showSum) {
            const result = {};
            const quizAnswers = quizAnswersCache[req.body.quizId];
            if (quizAnswers) {
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
              res.send({ answers: result, question: null });
            }
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

let run_scenario = false;

const postCommand = async (req, res, credential) => {
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
  if (req.body.type === 'cancel') {
    speech.emit('button', true);
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
    function stopAll() {
      dora.stop();
      talk.stop();
      //servoAction('idle');
      execSoundCommand({ sound: 'stop' });
      buttonClient.emit('stop-speech-to-text');
      buttonClient.emit('all-blink', {});
      // buttonClient.emit('close-all', {});
      speech.emit('data', 'stoped');
      led_mode = 'auto';
      servoAction('led-off');
      last_led_action = 'led-off';
      if (playerSocket) {
        playerSocket.emit('movie', { action: 'cancel', }, (data) => {
        });
      }
    }
    if (action == 'play') {
      run_scenario = true;
      const play = ({ filename, range, name }) => {
        stopAll();
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
          run_scenario = false;
        }
        try {
          const base = path.join(HOME, 'Documents');
          const username = (name) ? path.basename(name) : null;
          fs.readFile(path.join(base, username, filename), (err, data) => {
            if (err) {
              emitError(err);
              return;
            }
            dora.parse(data.toString(), filename, function (filename, callback) {
              fs.readFile(path.join(base, username, filename), (err, data) => {
                if (err) {
                  emitError(err);
                  return;
                }
                callback(data.toString());
              });
            }).then(()=> {
              dora.credential = credential;
              dora.play({ username, dora: { host: 'localhost', port: config.port, } }, {
                socket: localSocket,
                range,
              }, (err, msg) => {
                if (err) {
                  emitError(err);
                  if (err.info) {
                    if (err.info.lineNumber >= 1) {
                      console.log(`${err.info.lineNumber}行目でエラーが発生しました。\n\n${err.info.code}\n\n${err.info.reason}`);
                    } else {
                      console.log(`エラーが発生しました。\n\n${err.info.code}\n\n${err.info.reason}`);
                    }
                  } else {
                    console.log(`エラーが発生しました。\n\n`);
                  }
                  run_scenario = false;
                } else {
                  io.emit('scenario_status', {
                    message: msg,
                  });
                  buttonClient.emit('stop-speech-to-text');
                  buttonClient.emit('all-blink', {});
                  // buttonClient.emit('close-all', {});
                  speech.emit('data', 'stoped');
                  if (typeof msg._nextscript !== 'undefined') {
                    console.log(`msg._nextscript ${msg._nextscript}`);
                    if (run_scenario) {
                      play({
                        filename: msg._nextscript,
                        range: { start: 0, },
                        name: name,
                      });
                    }
                  }
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
      play(req.body);
    }
    if (action == 'stop') {
      run_scenario = false;
      stopAll();
    }
    if (action == 'load') {
      console.log(JSON.stringify(req.body));
      console.log(JSON.stringify(req.params));
      const username = ('username' in req.body) ? req.body.username : 'default-user';
      const uri = ('uri' in req.body) ? req.body.uri : null;
      const filename = ('filename' in req.body && req.body.filename !== null) ? req.body.filename : (('filename' in req.params) ? req.params.filename : null);
      const base = path.join(HOME, 'Documents');
      mkdirp(path.join(base, username, '.cache'), async function(err) {
        if (uri) {
          try {
            const body = await request({
              uri,
              method: 'POST',
              json: {
                type: 'scenario',
                action: 'load',
                filename,
                username,
              },
            });
            if ('text' in body && 'filename' in body) {
              fs.writeFile(path.join(base, username, '.cache', body.filename), body.text, (err) => {
                if (err) console.log(err);
                res.send({ status: (!err) ? 'OK' : err.code, next_script: `.cache/${body.filename}`, });
              })
            } else {
              res.send({ status: 'Not found', });
            }
          } catch(err) {
            console.log(err);
            res.send({ status: 'Not found', });
          }
          return;
        } else {
          if (filename) {
            const p = path.join(base, username, filename);
            console.log(`load ${p}`);
            fs.readFile(p, (err, data) => {
              if (err) {
                console.log(err);
                res.send({ status: 'Err', });
                return;
              }
              res.send({ status: 'OK', text: data.toString(), filename, });
            });
          } else {
            res.send({ status: 'Invalid filename', });
          }
        }
      })
      return;
    }
  }
  res.send({ status: 'OK' });
}

app.post('/command/:filename', hasPermission('command.write'), async (req, res) => {
  if (req.isAuthenticated()) {
    createSignature(req.user.id, (signature) => {
      postCommand(req, res, { user_id: req.user.id, signature });
    })
  } else {
    postCommand(req, res, { localhostToken: localhostToken(), });
  }
})

app.post('/command', hasPermission('command.write'), async (req, res) => {
  if (req.isAuthenticated()) {
    createSignature(req.user.id, (signature) => {
      postCommand(req, res, { user_id: req.user.id, signature });
    })
  } else {
    postCommand(req, res, { localhostToken: localhostToken(), });
  }
})

app.post('/scenario', hasPermission('scenario.write'), (req, res) => {
  const base = path.join(HOME, 'Documents');
  const username = (req.body.name) ? path.basename(req.body.name) : null;
  const filename = (req.body.filename) ? path.basename(req.body.filename) : null;
  if (username === 'admin-user') {
    if (req.body.action == 'save') {
      if (filename === '生徒リスト') {
        if (typeof req.body.text !== 'undefined') {
          if (filename) {
            mkdirp(HOME, function(err) {
              fs.writeFile(PART_LIST_FILE_PATH, req.body.text, (err) => {
                let r = utils.attendance.load(null, PART_LIST_FILE_PATH, null);
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
        fs.readFile(PART_LIST_FILE_PATH, (err, data) => {
          res.send({ status: (!err) ? 'OK' : err.code, text: (data) ? data.toString() : '', });
        });
      } else if (filename === '出席CSV') {
        const { dates, students } = utils.attendance.load(null, PART_LIST_FILE_PATH, path.join(HOME, 'date-list.txt'));
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
  if (students.some( m => m.name === username ) || config.editorAccessControl)
  {
    if (req.body.action == 'save' || req.body.action == 'create') {
      if (typeof req.body.text !== 'undefined' || req.body.action == 'create') {
        if (isValidFilename(filename)) {
          mkdirp(path.join(base, username), function(err) {
            if (req.body.action === 'create') {
              console.log(`create ${path.join(base, username, filename)}`);
              fs.open(path.join(base, username, filename), 'a', function (err, file) {
                if (err) console.log(err);
                res.send({ status: (!err) ? 'OK' : err.code, filename, });
              });
            } else {
              console.log(`save ${path.join(base, username, filename)}`);
              fs.writeFile(path.join(base, username, filename), req.body.text, (err) => {
                if (err) console.log(err);
                res.send({ status: (!err) ? 'OK' : err.code, });
              });
            }
          });
        } else {
          res.send({ status: 'Not found filename', });
        }
      } else {
        res.send({ status: 'No data', });
      }
    } else
    if (req.body.action == 'load') {
      if (isValidFilename(filename)) {
        mkdirp(path.join(base, username), function(err) {
          console.log(`load ${path.join(base, username, filename)}`);
          fs.readFile(path.join(base, username, filename), (err, data) => {
            if (err) console.log(err);
            res.send({ status: (!err) ? 'OK' : err.code, text: (data) ? data.toString() : '', });
          });
        });
      } else {
        res.send({ status: 'Not found filename', });
      }
    } else
    if (req.body.action == 'remove') {
      if (isValidFilename(filename)) {
        console.log(`unlink ${path.join(base, username, filename)}`);
        fs.unlink(path.join(base, username, filename), function (err) {
          if (err) console.log(err);
          res.send({ status: (!err) ? 'OK' : err.code, });
        });
      } else {
        res.send({ status: 'Not found filename', });
      }
    } else
    if (req.body.action == 'list') {
      mkdirp(path.join(base, username), function(err) {
        console.log(`list ${path.join(base, username)}`);
        readdirFileOnly(path.join(base, username), (err, items) => {
          if (err) console.log(err);
          res.send({ status: (!err) ? 'OK' : err.code, items, });
        });
      });
    } else {
      res.send({ status: 'OK' });
    }
  } else {
    res.send({ status: `Invalid username: ${username}` });
  }
})

const camera = new (require('./robot-camera'))();

camera.on('change', hasPermission('control.write'), (payload) => {
  console.log('camera changed');
  speech.emit('camera', payload);
});

/*
  カメラ連携

  curlコマンド使用例
  $ curl -X POST --data '[{"id":100, "area":200}]' --header "content-type:application/json" http://localhost:3090/camera
*/
app.post('/camera', hasPermission('control.write'), (req, res) => {
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
  const localhostCheck = (payload) => {
    if (localhostIPs.indexOf(socket.handshake.address) === -1) {
      payload.localhostToken = localhostToken();
    }
  }
  socket.on('disconnect', function () {
    playerSocket = null;
    console.log('disconnect iop');
    delete imageServers[socket.id];
    io.emit('imageServers', imageServers);
  });
  socket.on('notify', function(payload) {
    localhostCheck(payload);
    checkPermission(payload, '', (verified) => {
      if (verified) {
        const ip = socket.conn.remoteAddress.match(/^::ffff:(.+)$/);
        if (ip != null && payload.role === 'imageServer') {
          payload.host = ip[1];
          imageServers[socket.id] = payload;
          io.emit('imageServers', imageServers);
        }
      }
    })
  });
});

io.on('connection', function (socket) {
  console.log('connected io', socket.conn.remoteAddress);
  const localhostCheck = (payload) => {
    if (localhostIPs.indexOf(socket.handshake.address) === -1) {
      payload.localhostToken = localhostToken();
    }
  }
  socket.on('disconnect', function () {
    mode_slave = false;
    speech.recording = false;
    console.log('disconnect');
    delete quiz_masters[socket.id];
    console.log(Object.keys(quiz_masters));
  });
  socket.on('start-slave', function (payload) {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', (verified) => {
      if (verified) {
        mode_slave = true;
      }
    })
  });
  socket.on('docomo-chat', function (payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', (verified) => {
      if (verified) {
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
          return;
        } catch(err) {
          console.error(err);
        }
      }
      if (callback) callback({});
    })
  });
  socket.on('text-to-speech', function (payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', (verified) => {
      if (verified) {
        try {
          text_to_speech({
            ...payload,
          }, (err) => {
            if (callback) callback('OK');
          });
          return;
        } catch(err) {
          console.error(err);
        }
      }
      if (callback) callback('NG');
    })
  });
  socket.on('stop-text-to-speech', function (payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', (verified) => {
      if (verified) {
        talk.flush();
        if (callback) callback('OK');
        return;
      }
      if (callback) callback('NG');
    })
  });
  socket.on('speech-to-text', function (payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', (verified) => {
      if (verified) {
        try {
          speech_to_text({
            timeout: (typeof payload.timeout === 'undefined') ? 30000 : payload.timeout,
            threshold: (typeof payload.sensitivity === 'undefined') ? 2000 : payload.sensitivity,
            languageCode: (typeof payload.languageCode === 'undefined') ? 'ja-JP' : payload.languageCode,
            recording: (typeof payload.recording === 'undefined') ? true : payload.recording,
          }, (err, data) => {
            if (callback) callback(data);
          });
          return;
        } catch(err) {
          console.error(err);
        }
      }
      if (callback) callback('NG');
    })
  });
  socket.on('stop-speech-to-text', function (payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', (verified) => {
      if (verified) {
        speech.emit('data', 'stoped');
        if (callback) callback('OK');
        return;
      }
      if (callback) callback('NG');
    })
  });
  socket.on('command', function(payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'command.write', (verified) => {
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
        return;
      } catch(err) {
        console.error(err);
      }
      if (callback) callback();
    })
  });
  socket.on('message', function(payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', (verified) => {
      if (verified) {
        console.log('message', payload);
      }
      if (callback) callback();
    })
  });
  socket.on('quiz-command', function(payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', async (verified) => {
      if (verified) {
        const result = await quizPacket(payload);
        storeQuizPayload(result);
        io.emit('quiz', result);
      }
      if (callback) callback();
    })
  });
  socket.on('led-command', function(payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', (verified) => {
      if (verified) {
        changeLed(payload);
      }
      if (callback) callback();
    })
  });
  socket.on('sound-command', (payload, callback) => {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', (verified) => {
      if (verified) {
        execSoundCommand(payload);
      }
      if (callback) callback();
    })
  })
  socket.on('button-command', function(payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', (verified) => {
      if (verified) {
        buttonClient.doCommand(payload);
      }
      if (callback) callback();
    })
  });
  socket.on('quiz', function(payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, '', async (verified) => {
      if (verified) {
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
          const speechButton = (typeof payload.speechButton === 'undefined' || !payload.speechButton) ? false : true;
          if (speechButton) {
            console.log(`emit speech ${payload.answer}`);
            speech.emit('speech', payload.answer);
          }
          if (payload.name === quiz_master) return;
          const showSum = (typeof payload.showSum === 'undefined' || !payload.showSum) ? false : true;
          const noSave = (typeof payload.noSave === 'undefined' || !payload.noSave) ? false : true;
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
            if (!noSave) await db.update('updateAnswer', a);
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
            if (!noSave) writeRobotData();
          }
          Object.keys(quiz_masters).forEach( key => {
            quiz_masters[key].emit('quiz', {
              action: 'refresh',
              name: quiz_master,
            });
          });
        }
      }
      if (callback) callback();
    })
  });
  socket.on('quiz-button', function (payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'quiz-button.write', (verified) => {
      if (verified) {
        try {
          quiz_button({
            timeout: (typeof payload.timeout === 'undefined') ? 30000 : payload.timeout,
          }, (err, data) => {
            if (callback) callback(data);
          });
          return;
        } catch(err) {
          console.error(err);
        }
      }
      if (callback) callback();
    })
  });
  socket.on('stop-quiz-button', function (payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'quiz-button.write', (verified) => {
      if (verified) {
        buttonClient.emit('button', 'stoped');
      }
      if (callback) callback('OK');
    })
  });
  socket.on('dora-event', function (payload, callback) {
    localhostCheck(payload);
    checkPermission(payload, 'control.write', (verified) => {
      if ('action' in payload) {
        if (payload.action === 'log') {
          io.emit('scenario_log', {
            message: payload.message,
            lineNumber: payload.lineNumber,
            filename: payload.filename,
          });
        }
      }
      if (callback) callback('OK');
    })
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
          const _playone = spawn('/usr/bin/sudo', ['shutdown', '-f', 'now']);
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
    io.emit('button', payload);
    speech.emit('button', payload.state);
  }
});

const ioClient = require('socket.io-client');
const localSocket = ioClient(`http://localhost:${config.port}`);

localSocket.on('connect', () => {
  console.log('connected');
});

if (config.startScript && config.startScript.auto) {
  setTimeout(() => {
    console.log('request scenario');
    request({
      uri: `http://localhost:${config.port}/command`,
      method: 'POST',
      json: {
        type: 'scenario',
        action: 'play',
        name: config.startScript.username,
        filename: config.startScript.filename,
        localhostToken: localhostToken(),
        range: {
          start: 0,
        },
      }
    })
  }, 5000)
}

/*
  GET API

    /health

  POST API

    /docomo-chat
    /text-to-speech
    /speech-to-text
    /debug-speech
    /speech
    /mic-threshold
    /speech-language
    /google/text-to-speech
    /result
    /signature
    /command/:filename
    /command

      type:
        quiz
        led
        button
        cancel
        movie
        sound
        scenario

    /scenario

      action:
        save
        load
        create
        remove
        list

    /camera

*/
