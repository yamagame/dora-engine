const EventEmitter = require("events");
const os = require("os");
const ip = require("ip");
const express = require("express");
const router = require("express").Router();
const cookieParser = require("cookie-parser");
const axios = require("axios");
const speech = (() =>
  process.env["SPEECH"] === "off" ? new EventEmitter() : require("./speech"))();
const talk = require("./talk");
const config = require("./config");
const APIKEY = config.docomo.api_key;
const APPID = config.docomo.app_id;
const { exec, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const workFolder = "DoraEngine"; //for macOS(development)
const buttonClient = require("./button-client")(config);
const RobotDB = require("./robot-db");
const USE_DB = config.useDB;
const saveInterval = 1000;
const URL = require("url");
const googleRouter = require("./google-router");
const session = require("express-session");
const MemoryStore = require("memorystore")(session);
const passport = require("passport");
const DoraChat = require("./doraChat");
const LocalStrategy = require("passport-local").Strategy;
const { v4: uuidv4 } = require("uuid");
const mkdirp = require("mkdirp");
const UserDefaults = require("./user-defaults");
const { upload, readDir, deleteFile } = require("./fileServer");
const {
  localhostIPs,
  localIPCheck,
  createSignature,
  localhostToken,
  hasPermission,
  checkPermission,
} = require("./accessCheck");
const csrf = require("csurf");
const csrfProtection = csrf({ cookie: true });
const bcrypt = (() => {
  try {
    return require("bcrypt");
  } catch (e) {
    return require("bcryptjs");
  }
})();
const HOME =
  process.platform === "darwin"
    ? path.join(process.env.HOME, "Documents", workFolder)
    : process.env.HOME;
const PICT =
  process.platform === "darwin"
    ? path.join(process.env.HOME, "Documents", workFolder, "Pictures")
    : path.join(process.env.HOME, "Pictures");
const PART_LIST_FILE_PATH = path.join(HOME, "quiz-student.txt");

mkdirp(config.doraChat.dataDir, async function (err) {
  if (err) console.log(err);
});

const defaultBarData = {
  uuid: "",
  x: 0,
  y: 0,
  width: 24,
  height: 24,
  rgba: "#00FF00FF",
  type: "roundrect",
  title: null,
  text: null,
  info: {
    readOnly: false,
  },
};

const isLogined = function (view) {
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
      res.end("Unauthorized");
    }
  };
};

function isValidFilename(filename) {
  if (filename) {
    return path.basename(filename) === filename && path.normalize(filename) === filename;
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
          if (t.indexOf(".") !== 0) {
            r.push(t);
          }
        }
        check();
      });
    };
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

const Dora = require("dora");
const dora = new Dora();
const utils = require("./utils");
const dateutlis = require("date-utils");

dora.loadModule("button", function (DORA, config) {
  function connect(node, options) {
    const params = options.split("/");
    if (params.length < 1 || params === "") {
      throw new Error("ホスト名がありません。");
    }
    node.on("input", async function (msg) {
      let host = params[0];
      let port = null;
      if (host.indexOf(":") > 0) {
        const h = host.split(":");
        host = h[0];
        port = h[1];
      }
      const name = params.length > 1 ? params[1] : null;
      const team = params.length > 2 ? params[2] : null;
      buttonClient.emit("open-slave", { host, name, team, port });
      node.send(msg);
    });
  }
  DORA.registerType("connect", connect);

  function detect(node, options) {
    const params = options.split("/");
    if (params.length < 2 || params === "") {
      throw new Error("ベンダーID/プロダクトIDがありません。");
    }
    node.on("input", async function (msg) {
      let vendorId = params[0];
      let productId = params[1];
      gpioSocket.emit("gamepad", {
        action: "add",
        vendorId,
        productId,
      });
      node.send(msg);
    });
  }
  DORA.registerType("gamepad", detect);

  function close(node, options) {
    const params = options.split("/");
    if (params.length < 1 || params === "") {
      throw new Error("ホスト名がありません。");
    }
    node.on("input", async function (msg) {
      const host = params[0];
      buttonClient.emit("close-slave", { host });
      node.send(msg);
    });
  }
  DORA.registerType("close", close);

  function allBlink(node, options) {
    node.on("input", async function (msg) {
      buttonClient.emit("all-blink", {});
      node.send(msg);
    });
  }
  DORA.registerType("led-all-blink", allBlink);

  function allOn(node, options) {
    node.on("input", async function (msg) {
      buttonClient.emit("all-on", {
        bright: 1,
      });
      node.send(msg);
    });
  }
  DORA.registerType("led-all-on", allOn);

  function allOff(node, options) {
    node.on("input", async function (msg) {
      buttonClient.emit("all-off", {});
      node.send(msg);
    });
  }
  DORA.registerType("led-all-off", allOff);

  function ledOn(node, options) {
    node.on("input", async function (msg) {
      buttonClient.emit("one", {
        name: msg.button.name,
        bright: 1,
      });
      node.send(msg);
    });
  }
  DORA.registerType("led-on", ledOn);

  function sound(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      const socket = buttonClient.socket(msg.button.name);
      if (socket) {
        let message = options;
        if (isTemplated) {
          message = DORA.utils.mustache.render(message, msg);
        }
        socket.emit("sound-command", { sound: message });
      }
      node.send(msg);
    });
  }
  DORA.registerType("sound", sound);

  function soundAll(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      let message = options;
      if (isTemplated) {
        message = DORA.utils.mustache.render(message, msg);
      }
      buttonClient.emit("sound", { sound: message });
      node.send(msg);
    });
  }
  DORA.registerType("sound-all", soundAll);

  function speechToText(node, options) {
    node.nextLabel(options);
    node.on("input", async function (msg) {
      const socket = buttonClient.socket(msg.button.name);
      if (socket) {
        const params = {
          timeout: 30000,
          sensitivity: "keep",
        };
        if (typeof msg.timeout !== "undefined") {
          params.timeout = msg.timeout;
        }
        if (typeof msg.sensitivity !== "undefined") {
          params.sensitivity = msg.sensitivity;
        }
        node.recording = true;
        socket.emit("speech-to-text", params, res => {
          if (!node.recording) return;
          node.recording = false;
          if (res == "[timeout]") {
            msg.payload = "timeout";
            node.send([msg, null]);
          } else if (res == "[canceled]") {
            msg.payload = "canceled";
            node.send([msg, null]);
          } else if (res == "[camera]") {
            msg.payload = "camera";
            node.send([msg, null]);
          } else {
            if (res.button) {
              msg.payload = "button";
              msg.button = res;
              delete res.button;
              node.send([msg, null]);
            } else if (res.gamepad) {
              msg.payload = "gamepad";
              msg.gamepad = res;
              delete res.gamepad;
              node.send([null, msg]);
            } else if (res.speechRequest) {
              msg.speechRequest = true;
              msg.payload = res.payload;
              msg.speechText = msg.payload;
              msg.topicPriority = 0;
              node.send([null, msg]);
            } else if (typeof res === "object") {
              (msg.languageCode = res.languageCode),
                (msg.alternativeLanguageCodes = res.alternativeLanguageCodes),
                (msg.confidence = res.confidence);
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
        msg.payload = "timeout";
        node.send([msg, null]);
      }
    });
  }
  DORA.registerType("speech-to-text", speechToText);
});

dora.request = async function (command, options, params) {
  var len = 0;
  if (typeof command !== "undefined") len += 1;
  if (typeof options !== "undefined") len += 1;
  if (typeof params !== "undefined") len += 1;
  if (len <= 0) {
    throw new Error("Illegal arguments.");
  }
  const opt = {
    method: "POST",
    restype: "json",
  };
  if (len == 1) {
    params = command;
    command = "command";
  }
  if (len == 2) {
    params = options;
  }
  if (options) {
    if (options.method) opt.method = options.method;
    if (options.restype) opt.restype = options.restype;
  }
  params.localhostToken = localhostToken();
  const body = await axios({
    url: `http://localhost:${config.port}/${command}`,
    method: opt.method,
    data: params,
  });
  console.log(body);
  return body;
};

const quiz_master = process.env.QUIZ_MASTER || "_quiz_master_";

let led_mode = "auto";
let mode_slave = false;

// talk.dummy = (process.env['SPEECH'] === 'off' && process.env['MACINTOSH'] !== 'on');
talk.macvoice = process.env["MACINTOSH"] === "on";

let robotDataPath = process.argv[2] || path.join(HOME, "robot-data.json");

const m = function () {
  let res = {};
  for (let i = 0; i < arguments.length; ++i) {
    if (arguments[i]) Object.assign(res, arguments[i]);
  }
  return res;
};

try {
  var robotJson = fs.readFileSync(robotDataPath);
  var robotData = JSON.parse(robotJson);
} catch (err) {
  var robotData = {};
}
if (typeof robotData.quizAnswers === "undefined") robotData.quizAnswers = {};
if (typeof robotData.quizEntry === "undefined") robotData.quizEntry = {};
if (typeof robotData.quizPayload === "undefined") robotData.quizPayload = {};
if (typeof robotData.quizList === "undefined") robotData.quizList = {};
if (typeof robotData.recordingTime !== "undefined")
  speech.recordingTime = parseInt(robotData.recordingTime);
if (typeof robotData.voice === "undefined") robotData.voice = { level: 100, threshold: 2000 };
if (typeof robotData.barData === "undefined") robotData.barData = [];
if (typeof robotData.calendarData === "undefined") robotData.calendarData = {};
if (typeof robotData.autoStart === "undefined") robotData.autoStart = {};

if (speech.setParams) {
  speech.setParams(robotData.voice);
}

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
        const data = JSON.stringify(robotData, null, "  ");
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
          } catch (err) {
            console.error(err);
          }
        }
      }
      saveDelay = false;
    };
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
        t: "",
      },
    },
    appRecvTime: robotData.chatRecvTime ? robotData.chatRecvTime : sendTime,
    appSendTime: sendTime,
  };

  if (tone) {
    json.clientData.option.t = tone;
  }

  axios({
    method: "POST",
    url: "https://api.apigw.smt.docomo.ne.jp/naturalChatting/v1/dialogue?APIKEY=" + APIKEY,
    data: json,
  })
    .then(body => {
      callback(null, body);
      robotData.chatRecvTime = body.serverSendTime;
      writeRobotData();
    })
    .catch(err => {
      callback(err, null);
    });
}

speech.recording = false;

var last_led_action = "led-off";

const gpioSocket = (function () {
  const io = require("socket.io-client");
  return io(`http://localhost:${config.gpioPort}`);
})();

function servoAction(action, payload, callback) {
  if (process.env["MACINTOSH"] === "on") {
    if (callback) callback();
    return;
  }
  if (!gpioSocket.connected) {
    if (callback) callback();
    return;
  }
  let done = false;
  gpioSocket.emit("message", { action, ...payload }, payload => {
    if (done) return;
    done = true;
    //console.log(payload);
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

talk.on("idle", function () {
  //speech.recording = true;
});

talk.on("talk", function () {
  speech.recording = false;
});

speech.on("data", function (data) {
  Object.keys(soundAnalyzer).forEach(key => {
    const socket = soundAnalyzer[key];
    socket.emit("speech-data", data);
  });
});

speech.on("wave-data", function (data) {
  Object.keys(soundAnalyzer).forEach(key => {
    const socket = soundAnalyzer[key];
    socket.emit("wave-data", data);
  });
});

const app = express();

app.use((req, res, next) => {
  console.log(`# ${new Date().toLocaleString()} ${req.ip} ${req.url}`);
  console.log(`${JSON.stringify(req.headers)}`);
  next();
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ type: "application/json" }));
app.use(express.raw({ type: "application/*" }));
app.use(express.text());

app.use(cookieParser());

app.use("/images", express.static(PICT));

const sessionStore = new MemoryStore();
app.use(
  session({
    store: sessionStore,
    secret: config.sessionSecret,
    resave: false,
    proxy: true,
    // cookie: {
    //   maxAge: 10*365*24*60*60*1000,
    // },
    saveUninitialized: false,
  })
);

app.use((req, res, next) => {
  console.log("SessionID: " + req.sessionID);
  console.log("session: " + JSON.stringify(req.session));
  next();
});

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

passport.use(
  "local",
  new LocalStrategy(
    {
      passReqToCallback: true,
    },
    function (req, name, password, done) {
      //console.log(`name:${name} password:${password}`);
      setTimeout(function () {
        let auth = {};
        const checkPass = () => {
          return config.adminAuth.some(a => {
            if (name === a.username && bcrypt.compareSync(password, a.password)) {
              auth = a;
              return true;
            }
            return false;
          });
        };
        if (checkPass()) {
          done(null, {
            id: name,
            authInfo: { scope: auth.permissions },
            timestamp: new Date(),
          });
        } else {
          done(null, false, { message: "Incorrect password." });
        }
      }, 1000);
    }
  )
);

passport.use(
  "guest-client",
  new LocalStrategy(
    {
      passReqToCallback: true,
    },
    function (req, name, password, done) {
      setTimeout(function () {
        let auth = {};
        const checkPass = () => {
          return config.adminAuth.some(a => {
            if (a.guest) {
              if (name === a.username && bcrypt.compareSync(password, a.password)) {
                auth = a;
                return true;
              }
            }
            return false;
          });
        };
        if (checkPass()) {
          done(null, {
            id: name,
            authInfo: { scope: auth.permissions },
            timestamp: new Date(),
          });
        } else {
          console.log("Incorrect password");
          done(null, false, { message: "Incorrect password." });
        }
      }, 1000);
    }
  )
);

app.get("/admin-page", isLogined("admin"), function (req, res, next) {
  fs.createReadStream(path.join(__dirname, "public/admin-page/index.html")).pipe(res);
});

app.get("/scenario-editor", isLogined("editor"), function (req, res, next) {
  fs.createReadStream(path.join(__dirname, "public/scenario-editor/index.html")).pipe(res);
});

app.use((req, res, next) => {
  if (config.credentialAccessControl) {
    if (config.allowLocalhostAccess && localIPCheck(req)) {
      return next();
    }
    if (req.url.indexOf("/admin-page") === 0) {
      if (!req.isAuthenticated()) {
        return res.redirect("/login/admin");
      }
    }
    if (req.url.indexOf("/scenario-editor") === 0) {
      if (!req.isAuthenticated()) {
        return res.redirect("/login/editor");
      }
    }
  }
  return next();
}, express.static("public"));

app.get("/login/:view", csrfProtection, function (req, res, next) {
  res.render(`login-${req.params.view}`, { csrfToken: req.csrfToken() });
});

app.post("/login/:view", csrfProtection, function (req, res, next) {
  passport.authenticate("local", {
    successRedirect: req.params.view == "admin" ? "/admin-page" : "/scenario-editor",
    failureRedirect: `/login/${req.params.view}`,
  })(req, res, next);
});

app.post("/login-quiz-player", function (req, res, next) {
  if (req.isAuthenticated()) {
    res.send("OK\n");
    return;
  }
  req.body.username = "player";
  req.body.password = "playernopass";
  passport.authenticate("guest-client", (err, user, info) => {
    if (err) {
      res.statusCode = 401;
      res.end("Unauthorized");
    } else {
      req.logIn(user, {}, function (err) {
        if (err) {
          return next(err);
        }
        res.send("OK\n");
      });
    }
  })(req, res, next);
});

app.post("/login-guest-client", function (req, res, next) {
  const { username } = req.body;
  passport.authenticate("guest-client", (err, user, info) => {
    if (err) {
      res.statusCode = 401;
      res.end("Unauthorized");
    } else {
      req.logIn(user, {}, function (err) {
        if (err) {
          return next(err);
        }
        createSignature(username, signature => {
          res.send({
            user_id: username,
            signature,
          });
        });
      });
    }
  })(req, res, next);
});

app.post("/access-token", isLogined(), function (req, res) {
  if (req.user) {
    createSignature(req.user.id, signature => {
      res.json({ user_id: req.user.id, signature });
    });
  } else {
    res.json({ user_id: "none-user", signature: "dummy" });
  }
});

app.get("/logout/:view", function (req, res) {
  req.logout();
  res.redirect(`/login/${req.params.view}`);
});

function docomo_chat(payload, callback) {
  if (payload.tone == "kansai_dialect") {
    var tone = "kansai";
  } else if (payload.tone == "baby_talk_japanese") {
    var tone = "akachan";
  } else {
    var tone = "";
  }
  chat(payload.message, tone, function (err, body) {
    var utt = payload.message + "がどうかしましたか。";
    try {
      if (err) {
        console.error(err);
        if (callback) callback(err, "エラー");
        return;
      } else {
        utt = body.systemText.expression;
      }
      if (payload.silence) {
        if (callback) callback(err, utt);
      } else {
        if (led_mode == "auto") {
          servoAction("led-off");
          last_led_action = "led-off";
        }
        servoAction("centering", { direction: payload.direction }, () => {
          talk.voice = payload.voice;
          talk.play(
            utt,
            {
              ...payload,
            },
            mode => {
              if (mode === "idle") {
                servoAction("idle");
                if (callback) callback(err, utt);
              }
              if (mode === "talk") {
                servoAction("talk");
              }
            }
          );
        });
      }
    } catch (err) {
      console.error(err);
      if (callback) callback(err, "");
    }
  });
}

const doraChat = DoraChat(
  (function () {
    const r = {
      post: function (key, fn) {
        r[key] = fn;
      },
    };
    return r;
  })(),
  {
    credentialPath: config.googleSheet.credentialPath,
    tokenPath: config.googleSheet.tokenPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    cacheDir: config.doraChat.dataDir,
    wikipedia: config.doraChat.wikipedia,
    weather: config.doraChat.weather,
  }
);

function dora_chat(payload, callback) {
  const req = {
    body: {
      ...payload,
    },
  };
  const res = {
    send: function (res) {
      callback(null, res);
    },
  };
  doraChat[`/${payload.action}`](req, res);
}

var playing = false;

function text_to_speech(payload, callback) {
  if (!playing) {
    if (payload.silence) {
      if (callback) callback();
    } else {
      playing = true;
      if (led_mode == "auto") {
        servoAction("led-off");
        last_led_action = "led-off";
      }
      servoAction("centering", { direction: payload.direction }, () => {
        talk.play(
          payload.message,
          {
            ...payload,
          },
          mode => {
            if (mode === "idle") {
              servoAction("idle");
              playing = false;
              if (callback) callback();
            }
            if (mode === "talk") {
              servoAction("talk");
            }
          }
        );
      });
    }
  } else {
    if (callback) callback();
  }
}

function speech_to_text(payload, callback) {
  let done = false;
  speech.eventWating = true;

  //led_mode = 'auto';

  const threshold = payload.threshold;
  const level = payload.level;
  const languageCode = payload.languageCode;
  const alternativeLanguageCodes = payload.alternativeLanguageCodes;

  const stopRecording = () => {
    speech.recording = false;
    speech.eventWating = false;
    speech.emit("stopRecording");
    robotData.recordingTime = speech.recordingTime;
    writeRobotData();
  };

  const startRecording = () => {
    speech.recording = true;
    speech.emit("startRecording", {
      threshold,
      languageCode,
      alternativeLanguageCodes,
      level,
    });
  };

  const removeListener = () => {
    buttonClient.removeListener("button", listenerButton);
    buttonClient.removeListener("speech", listenerSpeech);
    speech.removeListener("data", dataListener);
    speech.removeListener("speech", speechListener);
    speech.removeListener("button", buttonListener);
    speech.removeListener("camera", cameraListener);
    speech.removeListener("gamepad", gamepadListener);
  };

  if (payload.timeout != 0) {
    setTimeout(() => {
      if (!done) {
        stopRecording();
        removeListener();
        if (callback) callback(null, "[timeout]");
        if (led_mode == "auto") {
          servoAction("led-off");
          last_led_action = "led-off";
        }
      }
      done = true;
    }, payload.timeout);

    if (payload.recording) {
      startRecording();
    }
  }

  const dataListener = payload => {
    if (!done) {
      stopRecording();
      removeListener();
      if (callback) callback(null, payload);
      if (led_mode == "auto") {
        servoAction("led-off");
        last_led_action = "led-off";
      }
    }
    done = true;
  };

  const speechListener = payload => {
    if (!done) {
      const retval = {
        speechRequest: true,
        payload,
      };
      stopRecording();
      removeListener();
      if (callback) callback(null, retval);
      if (led_mode == "auto") {
        servoAction("led-off");
        last_led_action = "led-off";
      }
    }
    done = true;
  };

  const buttonListener = payload => {
    if (payload) {
      if (!done) {
        stopRecording();
        removeListener();
        if (callback) callback(null, "[canceled]");
        if (led_mode == "auto") {
          servoAction("led-off");
          last_led_action = "led-off";
        }
      }
      done = true;
    }
  };

  const listenerButton = payload => {
    if (!done) {
      const data = {
        ...payload,
      };
      data.button = true;
      stopRecording();
      removeListener();
      if (callback) callback(null, data);
      if (led_mode == "auto") {
        servoAction("led-off");
        last_led_action = "led-off";
      }
    }
    done = true;
  };

  const listenerSpeech = payload => {
    if (!done) {
      const data = {};
      data.speechRequest = true;
      data.payload = payload.speech;
      stopRecording();
      removeListener();
      if (callback) callback(null, data);
      if (led_mode == "auto") {
        servoAction("led-off");
        last_led_action = "led-off";
      }
    }
    done = true;
  };

  const cameraListener = payload => {
    if (!done) {
      stopRecording();
      removeListener();
      if (callback) callback(null, "[camera]");
      if (led_mode == "auto") {
        servoAction("led-off");
        last_led_action = "led-off";
      }
    }
    done = true;
  };

  const gamepadListener = payload => {
    if (!done) {
      const data = {
        gamepad: true,
        ...payload,
      };
      stopRecording();
      removeListener();
      if (callback) callback(null, data);
      if (led_mode == "auto") {
        servoAction("led-off");
        last_led_action = "led-off";
      }
    }
    done = true;
  };

  if (led_mode == "auto") {
    if (payload.timeout > 0 && payload.recording) {
      servoAction("led-on");
      last_led_action = "led-on";
    } else {
      servoAction("led-off");
      last_led_action = "led-off";
    }
  }

  buttonClient.on("button", listenerButton);
  buttonClient.on("speech", listenerSpeech);
  speech.on("data", dataListener);
  speech.on("speech", speechListener);
  speech.on("button", buttonListener);
  speech.on("camera", cameraListener);
  speech.on("gamepad", gamepadListener);
}

function quiz_button(payload, callback) {
  var done = false;

  if (payload.timeout != 0) {
    setTimeout(() => {
      if (!done) {
        if (callback) callback(null, "[timeout]");
        buttonClient.removeListener("button", listener);
      }
      done = true;
    }, payload.timeout);
  }

  function listener(data) {
    if (!done) {
      if (callback) callback(null, data);
      buttonClient.removeListener("button", listener);
    }
    done = true;
  }

  buttonClient.on("button", listener);
}

app.get("/health", (req, res) => {
  res.send(`${new Date().toLocaleString()}`);
});

app.get("/recordingTime", (req, res) => {
  res.send(`${speech.recordingTime}`);
});

app.post("/docomo-chat", hasPermission("control.write"), (req, res) => {
  console.log("/docomo-chat");
  console.log(req.body);

  docomo_chat(
    {
      message: req.body.message,
      speed: req.body.speed || null,
      volume: req.body.volume || null,
      tone: req.body.tone || null,
      direction: req.body.direction || null,
      voice: req.body.voice || null,
      silence: req.body.silence || null,
    },
    (err, data) => {
      res.send(data);
    }
  );
});

app.post("/text-to-speech", hasPermission("control.write"), (req, res) => {
  console.log("/text-to-speech");
  console.log(req.body);

  text_to_speech(
    {
      ...req.body,
    },
    err => {
      res.send("OK");
    }
  );
});

app.post("/speech-to-text", hasPermission("control.write"), (req, res) => {
  console.log("/speech-to-text");
  console.log(req.body);

  speech_to_text(
    {
      timeout: typeof req.body.payload.timeout === "undefined" ? 30000 : req.body.payload.timeout,
      threshold:
        typeof req.body.payload.sensitivity === "undefined" ? 2000 : req.body.payload.sensitivity,
      level: typeof req.body.payload.level === "undefined" ? 100 : req.body.payload.level,
      languageCode:
        typeof req.body.payload.languageCode === "undefined"
          ? "ja-JP"
          : req.body.payload.languageCode,
      alternativeLanguageCodes:
        typeof req.body.payload.alternativeLanguageCodes === "undefined"
          ? null
          : req.body.payload.alternativeLanguageCodes,
      recording:
        typeof req.body.payload.recording === "undefined" ? true : req.body.payload.recording,
    },
    (err, data) => {
      res.send(data);
    }
  );
});

/*
  speech-to-textノードのデバッグ用
  Google Speech API に問い合わせないで curl コマンドでメッセージを送信できる

  curlコマンド使用例
  $ curl -X POST --data 'こんにちは' -H 'content-type:text/plain' http://192.168.X.X:3090/debug-speech
*/
app.post("/debug-speech", hasPermission("control.write"), (req, res) => {
  if (typeof req.body === "string") {
    speech.emit("data", req.body.toString("utf-8"));
  } else if (typeof req.body.payload === "string") {
    speech.emit("data", req.body.payload.toString("utf-8"));
  }
  res.send("OK");
});

app.post("/speech", hasPermission("control.write"), (req, res) => {
  if (typeof req.body === "string") {
    speech.emit("speech", req.body.toString("utf-8"));
  } else if (typeof req.body.payload === "string") {
    speech.emit("speech", req.body.payload.toString("utf-8"));
  }
  res.send("OK");
});

app.post("/text-to-speech/start", hasPermission("control.write"), (req, res) => {
  if (speech.eventWating) {
    res.json({ status: "OK" });
  } else {
    res.json({ status: "NG" });
  }
  if (typeof req.body === "string") {
    speech.emit("speech", req.body.toString("utf-8"));
  } else if (typeof req.body.payload === "string") {
    speech.emit("speech", req.body.payload.toString("utf-8"));
  }
});

app.post("/text-to-speech/stop", hasPermission("control.write"), (req, res) => {
  postCommand({ body: { type: "scenario", action: "sound-stop" } }, res, {
    localhostToken: localhostToken(),
  });
});

app.use(
  "/dora-chat",
  hasPermission("control.write"),
  DoraChat(router, {
    credentialPath: config.googleSheet.credentialPath,
    tokenPath: config.googleSheet.tokenPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    cacheDir: config.doraChat.dataDir,
    wikipedia: config.doraChat.wikipedia,
    weather: config.doraChat.weather,
  })
);

/*
  マイクによる音声認識の閾値を変更する
  閾値が0に近い程マイクの感度は高くなる

  curlコマンド使用例
  $ curl -X POST --data '200' http://192.168.X.X:3090/mic-threshold
*/
app.post("/mic-threshold", hasPermission("control.write"), (req, res) => {
  speech.emit("mic_threshold", req.body.toString("utf-8"));
  res.send("OK");
});

app.use("/google", hasPermission("control.write"), googleRouter);

function changeLed(payload) {
  if (mode_slave) {
    gpioSocket.emit("led-command", payload);
  } else {
    if (payload.action === "auto") {
      led_mode = "auto";
    }
    if (payload.action === "off") {
      led_mode = "manual";
      servoAction("led-off");
      last_led_action = "led-off";
    }
    if (payload.action === "on") {
      led_mode = "manual";
      servoAction("led-on");
      last_led_action = "led-on";
    }
    if (payload.action === "blink") {
      led_mode = "manual";
      servoAction("led-blink");
      last_led_action = "led-blink";
    }
    if (payload.action === "talk") {
      led_mode = "manual";
      servoAction("led-talk");
      last_led_action = "led-talk";
    }
  }
}

let playsnd = {};

function execSoundCommand(payload, callback) {
  const sound = typeof payload.play !== "undefined" ? payload.play : payload.sound;
  if (sound === "stop") {
    const pids = Object.keys(playsnd);
    const _playsnd = playsnd;
    let count = pids.length;
    if (count > 0) {
      playsnd = {};
      pids.forEach(pid => {
        const playone = _playsnd[pid];
        if (playone) {
          utils.kill(playone.pid, "SIGTERM", function () {
            count--;
            if (count <= 0) {
              if (callback) callback();
            }
          });
        }
      });
    } else {
      if (callback) callback();
    }
  } else if (typeof sound !== "undefined") {
    const base = path.join(HOME, "Sound");
    const p = path.normalize(path.join(base, sound));
    if (p.indexOf(base) == 0) {
      const cmd = process.platform === "darwin" ? "afplay" : "aplay";
      const opt = process.platform === "darwin" ? [p] : config.voiceHat ? [p] : [p];
      console.log(`/usr/bin/${cmd} ${p}`);
      const playone = spawn(`/usr/bin/${cmd}`, opt);
      playone.on("close", function () {
        console.log("close");
        delete playsnd[playone.pid];
        if (callback) callback();
      });
      playsnd[playone.pid] = playone;
    }
  }
}

async function quizPacket(payload) {
  // if (payload.action === 'result') {
  //   payload.result = quizAnswers[payload.question];
  // }
  if (payload.action === "entry") {
    payload.entry = Object.keys(robotData.quizEntry)
      .map(key => {
        return {
          clientId: robotData.quizEntry[key].clientId,
          name: robotData.quizEntry[key].name,
        };
      })
      .filter(v => v.name != quiz_master);
    //payload.name = quiz_master;
  }
  if (payload.action === "quiz-entry-init") {
    robotData.quizEntry = {};
    writeRobotData();
    const result = await quizPacket({
      action: "entry",
      name: quiz_master,
    });
    io.emit("quiz", result);
    setTimeout(() => {
      io.emit("quiz-reload-entry");
    }, 3000);
    return result;
  }
  if (payload.action === "quiz-entry") {
    const params = {};
    if ("backgroundImage" in payload) {
      params.backgroundImage = payload.backgroundImage;
    }
    if ("backgroundColor" in payload) {
      params.backgroundColor = payload.backgroundColor;
    }
    if ("quizMode" in payload) {
      params.quizMode = payload.quizMode;
    }
    if ("closeButton" in payload) {
      params.closeButton = payload.closeButton;
    }
    storeQuizPayload(params);
  }
  if (payload.action === "quiz-init") {
    //クイズデータの保存
    if (USE_DB) {
      const startTime = new Date();
      if (payload.quizId) {
        if (payload.pages) {
          for (var i = 0; i < payload.pages.length; i++) {
            const page = payload.pages[i];
            if (page.action == "quiz" && page.question) {
              const a = {
                quizId: payload.quizId,
                quizTitle: page.question,
                quizOrder: i,
                choices: page.choices,
                answers: page.answers,
                category: page.category,
                startTime,
              };
              if (payload.quizName) {
                a.quizName = payload.quizName;
              }
              db.update("updateQuiz", a);
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
          robotData.quizList[payload.quizId] = {};
        }
        if (payload.quizName) {
          robotData.quizList[payload.quizId].name = payload.quizName;
        }
        if (payload.pages) {
          if (!robotData.quizList[payload.quizId].quiz) {
            robotData.quizList[payload.quizId].quiz = {};
          }
          payload.pages.forEach(page => {
            if (page.action == "quiz" && page.question) {
              robotData.quizList[payload.quizId].quiz[page.question] = {
                choices: page.choices,
                answers: page.answers,
                category: page.category,
              };
            }
          });
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
  if (payload.action === "quiz-show") {
    //クイズの表示
    payload.action = "quiz-init";
  }
  if (payload.action === "quiz-ranking") {
    if (USE_DB) {
      if (typeof payload.quizId !== "undefined") {
        const { answers } = await db.findAnswers({
          quizId: payload.quizId,
          startTime: payload.quizStartTime,
        });
        //ゲストプレイヤーはランキングから外す
        const ret = {};
        if (answers) {
          Object.keys(answers).forEach(quizTitle => {
            const players = answers[quizTitle];
            ret[quizTitle] = {};
            if (players) {
              Object.keys(players).forEach(clientId => {
                const player = players[clientId];
                if (
                  player.name.indexOf("ゲスト") != 0 &&
                  player.name.indexOf("guest") != 0 &&
                  player.name.indexOf("学生講師") != 0
                ) {
                  ret[quizTitle][clientId] = {
                    name: player.name,
                    answer: player.answer,
                    time: player.time,
                  };
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
      if (typeof payload.quizId !== "undefined") {
        payload.quizAnswers = robotData.quizAnswers[payload.quizId];
        //ゲストプレイヤーはランキングから外す
        const ret = {};
        if (payload.quizAnswers) {
          Object.keys(payload.quizAnswers).forEach(quizId => {
            const players = payload.quizAnswers[quizId];
            ret[quizId] = {};
            if (players) {
              Object.keys(players).forEach(clientId => {
                const player = players[clientId];
                if (player.quizStartTime === payload.quizStartTime) {
                  if (
                    player.name.indexOf("ゲスト") != 0 &&
                    player.name.indexOf("guest") != 0 &&
                    player.name.indexOf("学生講師") != 0
                  ) {
                    ret[quizId][clientId] = {
                      name: player.name,
                      answer: player.answer,
                      time: player.time,
                    };
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
    payload.members = students.map(v => v.name);
  }
  if (payload.area) {
    const readFile = path => {
      return new Promise(resolve => {
        fs.readFile(path, (err, data) => {
          resolve(data);
        });
      });
    };
    const photo = payload.photo.replace("images/", "");
    const json = await readFile(path.join(PICT, photo));
    try {
      const data = JSON.parse(json);
      payload.photo = path.join(path.dirname(payload.photo), data.image);
      if (path.extname(payload.photo) === ".json") {
        payload.photo = payload.photo.replace(/.json$/, "");
      }
      payload.area = data.area;
    } catch (err) {
      if (path.extname(payload.photo) === ".json") {
        payload.photo = payload.photo.replace(/.json$/, "");
      }
      payload.area = [];
    }
  }
  try {
    payload.quizMode = robotData.quizPayload.others.quizMode;
  } catch (err) {}
  try {
    payload.closeButton = robotData.quizPayload.others.closeButton;
  } catch (err) {}
  return payload;
}

function storeQuizPayload(payload) {
  console.log(`storeQuizPayload`, payload);
  if (payload.name !== quiz_master) {
    robotData.quizPayload["others"] = m(robotData.quizPayload["others"], payload);
  }
  robotData.quizPayload[quiz_master] = m(robotData.quizPayload[quiz_master], payload);
  writeRobotData();
}

function loadQuizPayload(payload) {
  if (payload.name == quiz_master) {
    var val = robotData.quizPayload[quiz_master] || {};
  } else {
    var val = robotData.quizPayload["others"] || {};
  }
  val.members = students.map(v => v.name);
  console.log(`loadQuizPayload`, val);
  return m(val, { initializeLoad: true });
}

app.post("/result", hasPermission("result.read"), async (req, res) => {
  if (req.body.type === "answers") {
    if (req.body.quizId) {
      if (req.body.startTime) {
        const showSum = typeof req.body.showSum === "undefined" || !req.body.showSum ? false : true;
        //スタート時間が同じものだけを返す
        if (USE_DB) {
          if (showSum) {
            const result = {};
            const quizAnswers = quizAnswersCache[req.body.quizId];
            if (quizAnswers) {
              Object.keys(quizAnswers).map(quiz => {
                const qq = quizAnswers[quiz];
                const tt = {};
                Object.keys(qq).forEach(clientId => {
                  const answer = qq[clientId];
                  if (answer.quizStartTime === req.body.startTime) {
                    tt[clientId] = answer;
                  }
                });
                if (Object.keys(tt).length > 0) {
                  result[quiz] = tt;
                }
              });
              const question = robotData.quizList ? robotData.quizList[req.body.quizId] : null;
              res.send({ answers: result, question: question });
            } else {
              res.send({ answers: result, question: null });
            }
          } else {
            const retval = await db.findAnswers({
              quizId: req.body.quizId,
              startTime: req.body.startTime,
            });
            res.send(retval);
          }
        } else {
          const result = {};
          const quizAnswers = robotData.quizAnswers[req.body.quizId];
          Object.keys(quizAnswers).map(quiz => {
            const qq = quizAnswers[quiz];
            const tt = {};
            Object.keys(qq).forEach(clientId => {
              const answer = qq[clientId];
              if (answer.quizStartTime === req.body.startTime) {
                tt[clientId] = answer;
              }
            });
            if (Object.keys(tt).length > 0) {
              result[quiz] = tt;
            }
          });
          const question = robotData.quizList ? robotData.quizList[req.body.quizId] : null;
          res.send({ answers: result, question: question });
        }
      } else {
        //スタート時間のリストを返す
        if (USE_DB) {
          const retval = await db.startTimeList({ quizId: req.body.quizId });
          res.send(retval);
        } else {
          const quizAnswers = robotData.quizAnswers[req.body.quizId];
          const result = {};
          Object.keys(quizAnswers).map(quiz => {
            const qq = quizAnswers[quiz];
            Object.keys(qq).forEach(clientId => {
              result[qq[clientId].quizStartTime] = true;
            });
          });
          res.send({ startTimes: Object.keys(result) });
        }
      }
    } else {
      //クイズIDを返す
      if (USE_DB) {
        const list = await db.quizIdList();
        res.send(list);
      } else {
        const list = { quizIds: Object.keys(robotData.quizAnswers) };
        res.send(list);
      }
    }
    return;
  }
  res.send({ status: "OK" });
});

let run_scenario = false;

const postCommand = async (req, res, credential) => {
  if (req.body.type === "quiz") {
    const payload = await quizPacket(req.body);
    storeQuizPayload(payload);
    io.emit("quiz", payload);
    if (req.body.action == "quiz-ranking") {
      res.send(payload.quizAnswers);
      return;
    }
    if (req.body.action === "quiz-init") {
      res.send(payload.quizStartTime);
      return;
    }
  }
  if (req.body.type === "speech") {
    speech.emit("speech", req.body.speech);
  }
  if (req.body.type === "led") {
    changeLed(req.body);
  }
  if (req.body.type === "button") {
    buttonClient.doCommand(req.body);
  }
  if (req.body.type === "cancel") {
    speech.emit("button", true);
  }
  if (req.body.type === "movie") {
    if (playerSocket) {
      playerSocket.emit("movie", req.body, data => {
        res.send(data);
      });
      return;
    } else {
      res.send({ state: "none" });
      return;
    }
  }
  if (req.body.type === "sound.sync") {
    execSoundCommand(req.body, () => {
      res.send({ state: "ok" });
    });
    return;
  }
  if (req.body.type === "sound") {
    execSoundCommand(req.body);
  }
  if (req.body.type === "save") {
    const { action } = req.body;
    if (action === "imageMap") {
      const { filename, imageMap } = req.body;
      if (filename && imageMap) {
        let savefilePath = path.join(PICT, filename);
        if (path.resolve(savefilePath) === savefilePath) {
          if (path.extname(savefilePath.toLowerCase()) !== ".json") {
            savefilePath = `${savefilePath}.json`;
          }
          const writeFile = (path, data) => {
            return new Promise(resolve => {
              console.log(`write imageMap ${path}`);
              fs.writeFile(path, data, err => {
                console.log(err);
                resolve();
              });
            });
          };
          await writeFile(savefilePath, imageMap);
          try {
            const { area } = JSON.parse(imageMap);
            storeQuizPayload({ area });
          } catch (err) {}
        } else {
          console.log(`invalid filename ${filename}`);
        }
      } else {
        console.log(`invalid 'imageMap' save command `);
      }
    } else if (action === "defaults") {
      UserDefaults.load(config.robotUserDefaultsPath, (err, data) => {
        UserDefaults.save(config.robotUserDefaultsPath, req.body.data, err => {
          if (err) {
            console.log(err);
            res.send({ state: "ng" });
            return;
          }
          res.send({ state: "ok" });
        });
      });
      return;
    }
    res.send({ state: "ng" });
    return;
  }
  if (req.body.type === "load") {
    const { action } = req.body;
    if (action === "defaults") {
      UserDefaults.load(config.robotUserDefaultsPath, (err, data) => {
        if (err) {
          console.log(err);
          res.send({ state: "ng" });
          return;
        }
        res.send({ state: "ok", data });
      });
      return;
    }
    res.send({ state: "ng" });
    return;
  }
  if (req.body.type === "poweroff") {
    execPowerOff();
    res.send({ state: "ok" });
    return;
  }
  if (req.body.type === "reboot") {
    execReboot();
    res.send({ state: "ok" });
    return;
  }
  if (req.body.type === "scenario") {
    const { action } = req.body;
    function stopAll() {
      dora.stop();
      talk.stop();
      //servoAction('idle');
      execSoundCommand({ sound: "stop" }, () => {
        buttonClient.emit("stop-speech-to-text", {});
        buttonClient.emit("all-blink", {});
        // buttonClient.emit('close-all', {});
        speech.emit("data", "stoped");
        led_mode = "auto";
        servoAction("led-off");
        last_led_action = "led-off";
        if (playerSocket) {
          playerSocket.emit("movie", { action: "cancel" }, data => {});
        }
      });
    }
    if (action == "play") {
      run_scenario = true;
      const play = ({ filename, range, name }, defaults) => {
        stopAll();
        function emitError(err) {
          console.log(err);
          console.log(dora.errorInfo());
          err.info = dora.errorInfo();
          if (!err.info.reason) {
            err.info.reason = err.toString();
          }
          io.emit("scenario_status", {
            err: err.toString(),
            lineNumber: err.info.lineNumber,
            code: err.info.code,
            reason: err.info.reason,
          });
          run_scenario = false;
        }
        try {
          const base = path.join(HOME, "Documents");
          const username = name ? path.basename(name) : null;
          fs.readFile(path.join(base, username, filename), (err, data) => {
            if (err) {
              emitError(err);
              return;
            }
            dora
              .parse(data.toString(), filename, function (filename, callback) {
                fs.readFile(path.join(base, username, filename), (err, data) => {
                  if (err) {
                    emitError(err);
                    return;
                  }
                  callback(data.toString());
                });
              })
              .then(() => {
                dora.credential = credential;
                console.log(robotData.voice);
                dora.play(
                  {
                    username,
                    hostname: os.hostname(),
                    ip_address: ip.address(),
                    voice: {
                      sensitivity: robotData.voice.threshold,
                      level: robotData.voice.level,
                    },
                    speech: {
                      languageCode: config.defaultVoice,
                    },
                    dora: {
                      host: "localhost",
                      port: config.port,
                    },
                    defaults,
                  },
                  {
                    socket: localSocket,
                    range,
                  },
                  (err, msg) => {
                    if (err) {
                      emitError(err);
                      if (err.info) {
                        if (err.info.lineNumber >= 1) {
                          console.log(
                            `${err.info.lineNumber}行目でエラーが発生しました。\n\n${err.info.code}\n\n${err.info.reason}`
                          );
                        } else {
                          console.log(
                            `エラーが発生しました。\n\n${err.info.code}\n\n${err.info.reason}`
                          );
                        }
                      } else {
                        console.log(`エラーが発生しました。\n\n`);
                      }
                      run_scenario = false;
                    } else {
                      io.emit("scenario_status", {
                        message: msg,
                      });
                      buttonClient.emit("stop-speech-to-text", {});
                      buttonClient.emit("all-blink", {});
                      // buttonClient.emit('close-all', {});
                      speech.emit("data", "stoped");
                      if (typeof msg._nextscript !== "undefined") {
                        console.log(`msg._nextscript ${msg._nextscript}`);
                        if (run_scenario) {
                          play({
                            filename: msg._nextscript,
                            range: { start: 0 },
                            name: name,
                          });
                        }
                      }
                      console.log(msg);
                    }
                  }
                );
              })
              .catch(err => {
                emitError(err);
              });
          });
        } catch (err) {
          emitError(err);
        }
      };
      UserDefaults.load(config.robotUserDefaultsPath, (err, data) => {
        play(req.body, data);
      });
    }
    if (action == "stop") {
      run_scenario = false;
      stopAll();
    }
    if (action === "sound-stop") {
      talk.stop();
    }
    if (action == "load") {
      console.log(JSON.stringify(req.body));
      console.log(JSON.stringify(req.params));
      const username = "username" in req.body ? req.body.username : "default-user";
      const uri = "uri" in req.body ? req.body.uri : null;
      const filename =
        "filename" in req.body && req.body.filename !== null
          ? req.body.filename
          : "filename" in req.params
          ? req.params.filename
          : null;
      const base = path.join(HOME, "Documents");
      mkdirp(path.join(base, username, ".cache"), async function (err) {
        if (uri) {
          try {
            const body = await request({
              uri,
              method: "POST",
              json: {
                type: "scenario",
                action: "load",
                filename,
                username,
              },
            });
            if ("text" in body && "filename" in body) {
              fs.writeFile(path.join(base, username, ".cache", body.filename), body.text, err => {
                if (err) console.log(err);
                res.send({
                  status: !err ? "OK" : err.code,
                  next_script: `.cache/${body.filename}`,
                });
              });
            } else {
              res.send({ status: "Not found" });
            }
          } catch (err) {
            console.log(err);
            res.send({ status: "Not found" });
          }
          return;
        } else {
          if (filename) {
            const p = path.join(base, username, filename);
            console.log(`load ${p}`);
            fs.readFile(p, (err, data) => {
              if (err) {
                console.log(err);
                res.send({ status: "Err" });
                return;
              }
              res.send({ status: "OK", text: data.toString(), filename });
            });
          } else {
            res.send({ status: "Invalid filename" });
          }
        }
      });
      return;
    }
  }
  res.send({ status: "OK" });
};

app.post("/command/:filename", hasPermission("command.write"), async (req, res) => {
  if (req.isAuthenticated()) {
    createSignature(req.user.id, signature => {
      postCommand(req, res, { user_id: req.user.id, signature });
    });
  } else {
    postCommand(req, res, { localhostToken: localhostToken() });
  }
});

app.post("/command", hasPermission("command.write"), async (req, res) => {
  if (req.isAuthenticated()) {
    createSignature(req.user.id, signature => {
      postCommand(req, res, { user_id: req.user.id, signature });
    });
  } else {
    postCommand(req, res, { localhostToken: localhostToken() });
  }
});

app.post("/scenario", hasPermission("scenario.write"), (req, res) => {
  const base = path.join(HOME, "Documents");
  const username = req.body.name ? path.basename(req.body.name) : null;
  const filename = req.body.filename ? path.basename(req.body.filename) : null;
  if (username === "admin-user") {
    if (req.body.action == "save") {
      if (filename === "生徒リスト") {
        if (typeof req.body.text !== "undefined") {
          if (filename) {
            mkdirp(HOME, function (err) {
              fs.writeFile(PART_LIST_FILE_PATH, req.body.text, err => {
                let r = utils.attendance.load(null, PART_LIST_FILE_PATH, null);
                if (typeof r.students !== "undefined") students = r.students;
                res.send({ status: !err ? "OK" : err.code });
              });
            });
          } else {
            res.send({ status: "Not found filename" });
          }
        } else {
          res.send({ status: "No data" });
        }
      } else if (filename === "出席CSV") {
        res.send({ status: "OK" });
      } else if (filename === "日付リスト") {
        if (typeof req.body.text !== "undefined") {
          if (filename) {
            mkdirp(HOME, function (err) {
              fs.writeFile(path.join(HOME, "date-list.txt"), req.body.text, err => {
                res.send({ status: !err ? "OK" : err.code });
              });
            });
          } else {
            res.send({ status: "Not found filename" });
          }
        } else {
          res.send({ status: "No data" });
        }
      } else {
        res.send({ status: "OK" });
      }
    } else if (req.body.action == "load") {
      if (filename === "生徒リスト") {
        fs.readFile(PART_LIST_FILE_PATH, (err, data) => {
          res.send({
            status: !err ? "OK" : err.code,
            text: data ? data.toString() : "",
          });
        });
      } else if (filename === "出席CSV") {
        const { dates, students } = utils.attendance.load(
          null,
          PART_LIST_FILE_PATH,
          path.join(HOME, "date-list.txt")
        );
        if (USE_DB) {
          db.loadAttendance(dates).then(robotData => {
            res.send({
              status: "OK",
              text: utils.attendance.csv(robotData, dates, students),
            });
          });
        } else {
          res.send({
            status: "OK",
            text: utils.attendance.csv(robotData, dates, students),
          });
        }
      } else if (filename === "日付リスト") {
        fs.readFile(path.join(HOME, "date-list.txt"), (err, data) => {
          res.send({
            status: !err ? "OK" : err.code,
            text: data ? data.toString() : "",
          });
        });
      } else {
        res.send({ status: "OK" });
      }
    } else {
      res.send({ status: "OK" });
    }
  } else if (students.some(m => m.name === username) || config.editorAccessControl) {
    if (req.body.action == "save" || req.body.action == "create") {
      if (typeof req.body.text !== "undefined" || req.body.action == "create") {
        if (isValidFilename(filename)) {
          mkdirp(path.join(base, username), function (err) {
            if (req.body.action === "create") {
              console.log(`create ${path.join(base, username, filename)}`);
              fs.open(path.join(base, username, filename), "a", function (err, file) {
                if (err) console.log(err);
                res.send({ status: !err ? "OK" : err.code, filename });
              });
            } else {
              console.log(`save ${path.join(base, username, filename)}`);
              fs.writeFile(path.join(base, username, filename), req.body.text, err => {
                if (err) console.log(err);
                res.send({ status: !err ? "OK" : err.code });
              });
            }
          });
        } else {
          res.send({ status: "Not found filename" });
        }
      } else {
        res.send({ status: "No data" });
      }
    } else if (req.body.action == "load") {
      if (isValidFilename(filename)) {
        mkdirp(path.join(base, username), function (err) {
          console.log(`load ${path.join(base, username, filename)}`);
          fs.readFile(path.join(base, username, filename), (err, data) => {
            if (err) console.log(err);
            res.send({
              status: !err ? "OK" : err.code,
              text: data ? data.toString() : "",
            });
          });
        });
      } else {
        res.send({ status: "Not found filename" });
      }
    } else if (req.body.action == "remove") {
      if (isValidFilename(filename)) {
        console.log(`unlink ${path.join(base, username, filename)}`);
        fs.unlink(path.join(base, username, filename), function (err) {
          if (err) console.log(err);
          res.send({ status: !err ? "OK" : err.code });
        });
      } else {
        res.send({ status: "Not found filename" });
      }
    } else if (req.body.action == "list") {
      mkdirp(path.join(base, username), function (err) {
        console.log(`list ${path.join(base, username)}`);
        readdirFileOnly(path.join(base, username), (err, items) => {
          if (err) console.log(err);
          res.send({ status: !err ? "OK" : err.code, items });
        });
      });
    } else {
      res.send({ status: "OK" });
    }
  } else {
    res.send({ status: `Invalid username: ${username}` });
  }
});

const camera = new (require("./robot-camera"))();

camera.on("change", hasPermission("control.write"), payload => {
  console.log("camera changed");
  speech.emit("camera", payload);
});

/*
  カメラ連携

  curlコマンド使用例
  $ curl -X POST --data '[{"id":100, "area":200}]' --header "content-type:application/json" http://localhost:3090/camera
*/
app.post("/camera", hasPermission("control.write"), (req, res) => {
  camera.up(req.body);
  res.send({ status: "OK" });
});

function nomalizeBar(bar) {
  const b = {};
  const barAttrMembers = [
    "x",
    "y",
    "title",
    "uuid",
    "text",
    "width",
    "height",
    "info",
    "rgba",
    "type",
  ];
  barAttrMembers.forEach(key => {
    if (typeof bar[key] !== "undefined") {
      b[key] = bar[key];
    }
  });
  if (b.text == null) b.text = "";
  if (b.title == null) b.title = "";
  return b;
}

app.post("/bar/all", hasPermission("control.write"), async (req, res) => {
  const { bars } = req.body;
  if (bars) {
    if (USE_DB) {
      const barData = await db.loadBars();
      const b = [];
      bars.forEach(d => {
        barData.forEach(bar => {
          if (bar.uuid === d.uuid) {
            b.push(bar);
          }
        });
      });
      res.json(b);
    } else {
      const b = [];
      bars.forEach(d => {
        robotData.barData.forEach(bar => {
          if (bar.uuid === d.uuid) {
            b.push(bar);
          }
        });
      });
      res.json(b);
    }
  } else {
    if (USE_DB) {
      res.json(await db.loadBars());
    } else {
      res.json(robotData.barData);
    }
  }
});

app.post("/bar/update", hasPermission("control.write"), async (req, res) => {
  const bars = [...req.body.barData];
  const { saveOnly, create } = req.body;
  const newBars = [];
  if (USE_DB) {
    const b = {};
    const barData = await db.loadBars();
    barData.forEach(bar => {
      b[bar.uuid] = bar;
    });
    bars.forEach(bar => {
      if (bar) {
        if (create) {
          bar = nomalizeBar(bar);
          if (!bar.uuid) {
            bar.uuid = uuidv4();
          }
        } else {
          if (!bar.uuid) {
            return;
          }
        }
        Object.keys(defaultBarData).forEach(key => {
          if (typeof bar[key] === "undefined") {
            bar[key] = defaultBarData[key];
          }
        });
        const t = b[bar.uuid];
        if (t) {
          //更新
          if (bar.y === "auto") {
            delete bar.y;
          }
          barData.push(bar);
          newBars.push(bar);
        } else if (create) {
          //追加
          if (bar.y === "auto") {
            bar.y = 0;
            const q = barData
              .filter(b => b.x == bar.x)
              .sort((a, b) => {
                if (a.y < b.y) return -1;
                if (a.y > b.y) return 1;
                return 0;
              });
            q.forEach(b => {
              if (b.x === bar.x && b.y === bar.y) {
                bar.y += 24;
              }
            });
          }
          barData.push(bar);
          newBars.push(bar);
        }
      }
    });
    for (var i = 0; i < newBars.length; i++) {
      const bar = newBars[i];
      await db.updateBar(bar, defaultBarData);
    }
    if (!saveOnly) {
      iob.emit("update-schedule");
    }
  } else {
    const b = {};
    robotData.barData.forEach(bar => {
      b[bar.uuid] = bar;
    });
    bars.forEach(bar => {
      if (bar) {
        if (create) {
          bar = nomalizeBar(bar);
          if (!bar.uuid) {
            bar.uuid = uuidv4();
          }
          Object.keys(defaultBarData).forEach(key => {
            if (typeof bar[key] === "undefined") {
              bar[key] = defaultBarData[key];
            }
          });
        } else {
          if (!bar.uuid) {
            return;
          }
        }
        const t = b[bar.uuid];
        if (t) {
          //更新
          if (bar.y === "auto") {
            delete bar.y;
          }
          Object.keys(bar).forEach(key => {
            t[key] = bar[key];
          });
          newBars.push(t);
        } else if (create) {
          //追加
          if (bar.y === "auto") {
            bar.y = 0;
            const q = robotData.barData
              .filter(b => b.x == bar.x)
              .sort((a, b) => {
                if (a.y < b.y) return -1;
                if (a.y > b.y) return 1;
                return 0;
              });
            q.forEach(b => {
              if (b.x === bar.x && b.y === bar.y) {
                bar.y += 24;
              }
            });
          }
          robotData.barData.push(bar);
          newBars.push(bar);
        }
      }
    });
    writeRobotData();
    if (!saveOnly) {
      iob.emit("update-schedule", { bars: newBars });
    }
  }
  res.send({ status: "OK", bars: newBars });
});

app.post("/bar/delete", hasPermission("control.write"), (req, res) => {
  const bars = [...req.body.barData];
  const { saveOnly } = req.body;
  if (USE_DB) {
    bars.forEach(async bar => {
      await db.deleteBar(bar);
    });
    if (!saveOnly) {
      iob.emit("update-schedule");
    }
  } else {
    const b = [];
    robotData.barData.forEach(bar => {
      if (
        !bars.some(b => {
          return b.uuid === bar.uuid;
        })
      ) {
        b.push(bar);
      }
    });
    robotData.barData = b;
    writeRobotData();
    if (!saveOnly) {
      iob.emit("update-schedule");
    }
  }
  res.send({ status: "OK" });
});

app.post("/bar/findOne", hasPermission("control.write"), async (req, res) => {
  const { x, y, title } = req.body;
  let cbar = [];
  if (USE_DB) {
    if (typeof title !== "undefined" && title !== null) {
      cbar = await db.findBars({
        [db.Op.or]: [{ title }, { uuid: title }],
      });
    } else if (typeof x !== "undefined" && x !== null) {
      cbar = await db.findBars({
        x: {
          [db.Op.lte]: x,
        },
      });
    } else if (typeof y !== "undefined" && y !== null) {
      cbar = await db.findBars({
        y: {
          [db.Op.lte]: y,
        },
      });
    } else {
      cbar = await db.loadBars();
    }
  } else {
    cbar = [...robotData.barData];
  }
  if (typeof x !== "undefined" && x !== null) {
    cbar = cbar.filter(b => {
      return b.x <= x && x < b.x + b.width;
    });
  }
  if (typeof y !== "undefined" && y !== null) {
    cbar = cbar.filter(b => {
      return b.y <= y && y < b.y + b.height;
    });
  }
  if (typeof title !== "undefined" && title !== null) {
    cbar = cbar.filter(b => {
      return b.title.indexOf(title) >= 0 || b.uuid.indexOf(title) >= 0;
    });
  }
  cbar = cbar.sort((a, b) => {
    if (a.y < b.y) return -1;
    if (a.y > b.y) return 1;
    if (a.x < b.x) return -1;
    if (a.x > b.x) return 1;
    return 0;
  });
  if (cbar.length > 0) {
    res.send({ ...nomalizeBar(cbar[0]), status: "found" });
  } else {
    res.send({ status: "not found" });
  }
});

app.post("/bar/move-screen", hasPermission("control.write"), async (req, res) => {
  const { time, uuid } = req.body;
  if (uuid) {
    iob.emit("move-to-center", { uuid });
  } else if (time) {
    iob.emit("move-to-day", { time });
  } else {
    function DayToString(d) {
      return `${d.getFullYear()}-${("00" + (d.getMonth() + 1)).slice(-2)}-${(
        "00" + d.getDate()
      ).slice(-2)}`;
    }
    iob.emit("move-to-day", { time: DayToString(new Date()) });
  }
  res.send({ status: "OK" });
});

app.post("/calendar", hasPermission("control.write"), async (req, res) => {
  const calendarData = "calendarData" in req.body ? { ...req.body.calendarData } : null;
  if (calendarData) {
    robotData.calendarData = calendarData;
    writeRobotData();
  }
  res.send({ status: "OK" });
});

app.get("/calendar", async (req, res) => {
  res.send(robotData.calendarData);
});

app.post("/autostart", hasPermission("control.write"), async (req, res) => {
  const autostart = "autostart" in req.body ? { ...req.body.autostart } : null;
  if (autostart) {
    robotData.autoStart = autostart;
    writeRobotData();
  }
  res.send({ status: "OK" });
});

app.get("/autostart", async (req, res) => {
  if (robotData.autoStart.username && robotData.autoStart.filename) {
    res.send(robotData.autoStart);
  } else if (config.startScript && config.startScript.auto) {
    res.send({
      username: config.startScript.username,
      filename: config.startScript.filename,
    });
  } else {
    res.send({});
  }
});

app.post("/file/upload/pictures/:subdir", hasPermission("control.write"), async (req, res) => {
  upload(req, res, PICT, req.params.subdir);
});

app.post("/file/readDir/pictures/:subdir", hasPermission("control.write"), async (req, res) => {
  readDir(req, res, PICT, req.params.subdir);
});

app.post(
  "/file/delete/pictures/:subdir/:filename",
  hasPermission("control.write"),
  async (req, res) => {
    deleteFile(req, res, PICT, req.params.subdir, req.params.filename);
  }
);

const server = require("http").Server(app);
const io = require("socket.io")(server);
const ioa = io.of("audio");
const iob = io.of("bar");
const iop = io.of("player");
var playerSocket = null;

const quiz_masters = {};
const soundAnalyzer = {};
const imageServers = {};

iop.on("connection", function (socket) {
  console.log("connected io player", socket.conn.remoteAddress);
  playerSocket = socket;
  const localhostCheck = (payload = {}) => {
    if (localhostIPs.indexOf(socket.handshake.address) === -1) {
      payload.localhostToken = localhostToken();
    }
  };
  socket.on("disconnect", function () {
    playerSocket = null;
    console.log("disconnect io player");
    delete imageServers[socket.id];
    io.emit("imageServers", imageServers);
  });
  socket.on("notify", function (payload) {
    localhostCheck(payload);
    checkPermission(payload, "", verified => {
      if (verified) {
        const ip = socket.conn.remoteAddress.match(/^::ffff:(.+)$/);
        if (ip != null && payload.role === "imageServer") {
          payload.host = ip[1];
          imageServers[socket.id] = payload;
          io.emit("imageServers", imageServers);
        }
      }
    });
  });
});

ioa.on("connection", function (socket) {
  console.log("connected io audio", socket.conn.remoteAddress);
  const localhostCheck = payload => {
    if (localhostIPs.indexOf(socket.handshake.address) === -1) {
      payload.localhostToken = localhostToken();
    }
  };
  socket.on("disconnect", function () {
    console.log("disconnect io audio");
    delete soundAnalyzer[socket.id];
    if (Object.keys(soundAnalyzer).length == 0) {
      //停止
      speech.emit("stopStreamData");
    }
  });
  socket.on("speech-config", payload => {
    localhostCheck(payload);
    checkPermission(payload, "", verified => {
      if (verified) {
        const ip = socket.conn.remoteAddress.match(/^::ffff:(.+)$/);
        if (ip != null && payload.role === "waveAnalyzer") {
          ["level", "threshold"].forEach(key => {
            if (typeof payload[key] !== "undefined") {
              robotData.voice[key] = payload[key];
            }
          });
          writeRobotData();
          if (speech.stream) speech.stream.changeParameters(payload);
        }
      }
    });
  });
  socket.on("start-stream-data", payload => {
    localhostCheck(payload);
    checkPermission(payload, "", verified => {
      if (verified) {
        const ip = socket.conn.remoteAddress.match(/^::ffff:(.+)$/);
        if (ip != null && payload.role === "waveAnalyzer") {
          if (Object.keys(soundAnalyzer).length == 0) {
            speech.emit("startStreamData");
          }
          soundAnalyzer[socket.id] = socket;
        }
      }
    });
  });
});

io.on("connection", function (socket) {
  console.log("connected io", socket.conn.remoteAddress);
  const localhostCheck = payload => {
    if (localhostIPs.indexOf(socket.handshake.address) === -1) {
      payload.localhostToken = localhostToken();
    }
  };
  socket.on("disconnect", function () {
    mode_slave = false;
    speech.recording = false;
    console.log("disconnect");
    delete quiz_masters[socket.id];
    console.log(Object.keys(quiz_masters));
  });
  socket.on("start-slave", function (payload) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        mode_slave = true;
      }
    });
  });
  socket.on("docomo-chat", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        try {
          docomo_chat(
            {
              message: payload.message,
              speed: payload.speed || null,
              volume: payload.volume || null,
              tone: payload.tone || null,
              direction: payload.direction || null,
              voice: payload.voice || null,
              silence: payload.silence || null,
            },
            (err, data) => {
              if (callback) callback(data);
            }
          );
          return;
        } catch (err) {
          console.error(err);
        }
      }
      if (callback) callback({});
    });
  });
  socket.on("dora-chat", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        try {
          dora_chat(
            {
              message: payload.message,
              action: payload.action || "",
              sheetId: payload.sheetId || null,
              sheetName: payload.sheetName || null,
              download: payload.download || null,
              useMecab: payload.useMecab || null,
            },
            (err, data) => {
              if (callback) callback(data);
            }
          );
          return;
        } catch (err) {
          console.error(err);
        }
      }
      if (callback) callback({});
    });
  });
  socket.on("text-to-speech", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        try {
          text_to_speech(
            {
              ...payload,
            },
            err => {
              if (callback) callback("OK");
            }
          );
          return;
        } catch (err) {
          console.error(err);
        }
      }
      if (callback) callback("NG");
    });
  });
  socket.on("stop-text-to-speech", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        talk.flush();
        if (callback) callback("OK");
        return;
      }
      if (callback) callback("NG");
    });
  });
  socket.on("stop-speech", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        if (payload.option === "stop-sound") {
          execSoundCommand({ sound: "stop" }, () => {
            buttonClient.emit("stop-speech-to-text", {});
            speech.emit("data", "stoped");
            talk.stop(() => {
              if (callback) callback("OK");
            });
          });
        } else {
          buttonClient.emit("stop-speech-to-text", {});
          speech.emit("data", "stoped");
          talk.stop(() => {
            if (callback) callback("OK");
          });
        }
        return;
      }
      if (callback) callback("NG");
    });
  });
  socket.on("speech-to-text", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        try {
          speech_to_text(
            {
              timeout: typeof payload.timeout === "undefined" ? 30000 : payload.timeout,
              threshold: typeof payload.sensitivity === "undefined" ? 2000 : payload.sensitivity,
              level: typeof payload.level === "undefined" ? 100 : payload.level,
              languageCode:
                typeof payload.languageCode === "undefined" ? "ja-JP" : payload.languageCode,
              alternativeLanguageCodes:
                typeof payload.alternativeLanguageCodes === "undefined"
                  ? null
                  : payload.alternativeLanguageCodes,
              recording: typeof payload.recording === "undefined" ? true : payload.recording,
            },
            (err, data) => {
              if (callback) callback(data);
            }
          );
          return;
        } catch (err) {
          console.error(err);
        }
      }
      if (callback) callback("NG");
    });
  });
  socket.on("stop-speech-to-text", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        speech.emit("data", "stoped");
        if (callback) callback("OK");
        return;
      }
      if (callback) callback("NG");
    });
  });
  socket.on("command", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "command.write", verified => {
      try {
        const base = config.commandDirPath;
        const cmd = path.normalize(path.join(base, payload.command));
        const args = payload.args || "";
        if (cmd.indexOf(base) == 0) {
        } else {
          console.log("NG");
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
      } catch (err) {
        console.error(err);
      }
      if (callback) callback();
    });
  });
  socket.on("message", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        console.log("message", payload);
      }
      if (callback) callback();
    });
  });
  socket.on("quiz-command", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", async verified => {
      if (verified) {
        const result = await quizPacket(payload);
        storeQuizPayload(result);
        io.emit("quiz", result);
      }
      if (callback) callback();
    });
  });
  socket.on("led-command", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        changeLed(payload);
      }
      if (callback) callback();
    });
  });
  socket.on("sound-command", (payload, callback) => {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        execSoundCommand(payload);
      }
      if (callback) callback();
    });
  });
  socket.on("button-command", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if (verified) {
        buttonClient.doCommand(payload);
      }
      if (callback) callback();
    });
  });
  socket.on("quiz", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "", async verified => {
      if (verified) {
        payload.time = new Date();
        if (typeof payload.question === "undefined") {
          //参加登録
          if (typeof payload.clientId !== "undefined") {
            robotData.quizEntry[payload.clientId] = payload;
            console.log(payload.name);
            if (payload.name === quiz_master) {
              quiz_masters[socket.id] = socket;
            }
            writeRobotData();
            const quizPayload = await quizPacket({
              action: "entry",
              name: quiz_master,
            });
            Object.keys(quiz_masters).forEach(key => {
              quiz_masters[key].emit("quiz", quizPayload);
            });
            socket.emit("quiz", loadQuizPayload(payload));
            socket.emit("imageServers", imageServers);
          }
        } else {
          const speechButton =
            typeof payload.speechButton === "undefined" || !payload.speechButton ? false : true;
          if (speechButton) {
            console.log(`emit speech ${payload.answer}`);
            speech.emit("speech", payload.answer);
          }
          if (payload.name === quiz_master) return;
          const showSum = typeof payload.showSum === "undefined" || !payload.showSum ? false : true;
          const noSave = typeof payload.noSave === "undefined" || !payload.noSave ? false : true;
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
              delete p.question;
              delete p.quizId;
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
            };
            if (!noSave) await db.update("updateAnswer", a);
          } else {
            const quizId = payload.quizId;
            if (robotData.quizAnswers[quizId] == null) {
              robotData.quizAnswers[quizId] = {};
            }
            if (robotData.quizAnswers[quizId][payload.question] == null) {
              robotData.quizAnswers[quizId][payload.question] = {};
            }
            const p = { ...payload };
            delete p.question;
            delete p.quizId;
            robotData.quizAnswers[quizId][payload.question][payload.clientId] = p;
            if (!noSave) writeRobotData();
          }
          Object.keys(quiz_masters).forEach(key => {
            quiz_masters[key].emit("quiz", {
              action: "refresh",
              name: quiz_master,
            });
          });
        }
      }
      if (callback) callback();
    });
  });
  socket.on("quiz-button", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "quiz-button.write", verified => {
      if (verified) {
        try {
          quiz_button(
            {
              timeout: typeof payload.timeout === "undefined" ? 30000 : payload.timeout,
            },
            (err, data) => {
              if (callback) callback(data);
            }
          );
          return;
        } catch (err) {
          console.error(err);
        }
      }
      if (callback) callback();
    });
  });
  socket.on("stop-quiz-button", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "quiz-button.write", verified => {
      if (verified) {
        buttonClient.emit("button", "stoped");
      }
      if (callback) callback("OK");
    });
  });
  socket.on("dora-event", function (payload, callback) {
    if (typeof payload === "undefined") {
      if (callback) callback("NG");
      return;
    }
    localhostCheck(payload);
    checkPermission(payload, "control.write", verified => {
      if ("action" in payload) {
        if (payload.action === "log") {
          io.emit("scenario_log", {
            message: payload.message,
            lineNumber: payload.lineNumber,
            filename: payload.filename,
          });
        }
      }
      if (callback) callback("OK");
    });
  });
});

const startServer = function () {
  if (USE_DB) {
    return RobotDB(
      `${HOME}/robot-server.db`,
      {
        operatorsAliases: false,
      },
      async (err, db) => {
        server.listen(config.port, () =>
          console.log(`robot-server listening on port ${config.port}!`)
        );
      }
    );
  }
  server.listen(config.port, () => console.log(`robot-server listening on port ${config.port}!`));
  return {};
};

const db = startServer();

var shutdownTimer = null;
var shutdownLEDTimer = null;
var doShutdown = false;

function execPowerOff() {
  gpioSocket.emit("led-command", { action: "on" });
  //シャットダウン
  doShutdown = true;
  servoAction("stop");
  setTimeout(() => {
    if (process.platform === "darwin") {
      process.exit(0);
    } else {
      const _playone = spawn("/usr/bin/sudo", ["shutdown", "-f", "now"]);
      _playone.on("close", function (code) {
        console.log("shutdown done");
      });
    }
    doShutdown = false;
  }, 5000);
}

function execReboot() {
  gpioSocket.emit("led-command", { action: "on" });
  //シャットダウン
  doShutdown = true;
  servoAction("stop");
  setTimeout(() => {
    if (process.platform === "darwin") {
      process.exit(0);
    } else {
      const _playone = spawn("/usr/bin/sudo", ["reboot"]);
      _playone.on("close", function (code) {
        console.log("shutdown done");
      });
    }
    doShutdown = false;
  }, 5000);
}

gpioSocket.on("button", payload => {
  // console.log(payload);
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
  if (shutdownLEDTimer) {
    clearTimeout(shutdownLEDTimer);
    shutdownLEDTimer = null;
  }
  if (payload.state) {
    if (config.usePowerOffButton) {
      if (shutdownTimer) clearTimeout(shutdownTimer);
      shutdownTimer = setTimeout(() => {
        gpioSocket.emit("led-command", { action: "power" });
        //さらに５秒間押し続け
        if (shutdownLEDTimer) {
          clearTimeout(shutdownLEDTimer);
          shutdownLEDTimer = null;
        }
        shutdownLEDTimer = setTimeout(() => {
          execPowerOff();
        }, 5 * 1000);
      }, 5 * 1000);
    }
  } else {
    if (!doShutdown) {
      if (last_led_action) {
        servoAction(last_led_action);
      }
    }
  }
  if (!doShutdown) {
    io.emit("button", payload);
    speech.emit("button", payload.state);
  }
});

gpioSocket.on("gamepad", payload => {
  speech.emit("gamepad", payload);
});

const ioClient = require("socket.io-client");
const localSocket = ioClient(`http://localhost:${config.port}`);

localSocket.on("connect", () => {
  console.log("connected");
});

const checkScenarioFile = (name, filename, callback) => {
  const base = path.join(HOME, "Documents");
  const username = name ? path.basename(name) : null;
  const p = path.join(base, username, filename);
  fs.stat(p, (err, stat) => {
    if (err) {
      return;
    }
    if (stat.isFile()) {
      callback();
    }
  });
};

function startSenario(username, filename) {
  checkScenarioFile(username, filename, () => {
    setTimeout(() => {
      console.log(`request scenario ${username}:${filename}`);
      createSignature(username, signature => {
        postCommand(
          {
            body: {
              type: "scenario",
              action: "play",
              filename,
              range: {
                start: 0,
              },
              name: username,
            },
          },
          {
            send: () => {},
          },
          { user_id: username, signature }
        );
      });
    }, 5000);
  });
}

if (robotData.autoStart.username && robotData.autoStart.filename) {
  const username = robotData.autoStart.username;
  const filename = robotData.autoStart.filename;
  startSenario(username, filename);
} else if (config.startScript && config.startScript.auto) {
  const username = config.startScript.username;
  const filename = config.startScript.filename;
  startSenario(username, filename);
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
