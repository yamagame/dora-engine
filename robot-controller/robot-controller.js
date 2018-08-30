const request = require('request');
const io = require('socket.io-client');
const mecab_proc = require('./mecab-proc');

const requestTimeout = 3000;
const connectTimeout = 30000;

var sockets = {};

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
}

function timeout(timeout, callback) {
  var done = false;
  setTimeout(() => {
    if (done) return;
    done = true;
    callback(new Error('timeout'), null);
  }, timeout);
  return function(socket) {
    if (done) return;
    done = true;
    callback(null, socket);
  }
}

function removeSocket(host, id, node) {
  node.log(id);
  const t = sockets[host];
  if (t) {
    if (t.node[id]) {
      delete t.node[id];
      if (Object.keys(t.node).length <= 0) {
        t.socket.close();
        delete sockets[host];
        node.log('socket close');
      }
    }
  }
}

function createSocket(host, id, node, callback) {
  node.log(id);
  if (sockets[host]) {
    const t = sockets[host];
    t.node[id] = true;
    if (t.socket.connected) {
      if (callback) callback(t.socket);
    }
    return t.socket;
  }
  const socket = io(host);
  socket.on('connect', function(){
    node.log('socket connect');
    if (callback) callback(socket);
  });
  socket.on('event', function(data){
    node.log('socket event');
  });
  socket.on('disconnect', function(){
    node.log('socket disconnect');
  });
  const q = {}
  q[id] = true;
  sockets[host] = {
    socket: socket,
    node: q,
  }
  return socket;
}

function getId(node, name) {
  return ((Math.random() * 999999) | 0)+'-'+name;
}

//Socket.IOによる接続
function _request(node, action, host, body, callback) {
  if (!host) host = 'http://localhost:3090';
  const id = getId(node, action);
  const socket = createSocket(host, id, node, timeout(requestTimeout, (err, socket) => {
    if (err) {
      if (callback) callback(null, '');
      return;
    }
    node.log('emit '+action);
    socket.emit(action, body, (data) => {
      setTimeout(() => {
        removeSocket(host, id, node);
      }, connectTimeout);
      if (callback) callback(null, data);
    });
  }));
}

class Play {
  constructor(){
    this.org_message = null;
    this.canceled = true;
  }

  textToSpeech(node, message, host, params, callback) {
    params.message = message;
    _request(node, 'text-to-speech', host, params, callback);
  }

  stop(node) {
    if (this.canceled === false && this.host) {
      _request(node, 'stop-text-to-speech', this.host, {});
      this.canceled = true;
    }
  }

  delay(time, callback) {
    setTimeout(() => {
      callback(null, 'OK');
    }, time * 1000);
  }

  nextPage(node, host, callback) {
    _request(node, 'command', host, {
      command: 'right-key.cmd',
      args: '',
    }, callback);
  }

  prevPage(node, host, callback) {
    _request(node, 'command', host, {
      command: 'left-key.cmd',
      args: '',
    }, callback);
  }

  topPage(node, host, callback) {
    _request(node, 'command', host, {
      command: 'page-key.cmd',
      args: '1',
    }, callback);
  }

  openPage(node, host, page, callback) {
    _request(node, 'command', host, {
      command: 'page-key.cmd',
      args: page,
    }, callback);
  }

  quizCommand(node, host, params, callback) {
    _request(node, 'quiz-command', host, params, callback);
  }

  doShuffle() {
    for (var i=0;i<this.shuffle.length*10;i++) {
      const a = getRndInteger(0, this.shuffle.length);
      const b = getRndInteger(0, this.shuffle.length);
      const c = this.shuffle[a];
      this.shuffle[a] = this.shuffle[b];
      this.shuffle[b] = c;
    }
    this.shufflePtr = 0;
  }

  getMessage(messages) {
    if (this.org_message == null || this.org_message != messages) {
      this.org_message = messages;
      var n = 0;
      const res = [];
      this.shuffle = [];
      messages.split('\n').forEach( (line, i) => {
        if (line != '') {
          res.push(line.split(':'));
          this.shuffle.push(n);
          n++;
        }
      });
      this.messages = res;
      this.doShuffle();
    }
    return this.messages;
  }

  request(node, msg, params, callback) {
    if (params.silence) {
      callback(null, 'OK');
      return;
    }
    this.canceled = false;
    const { robotHost } = msg;
    const host = robotHost;
    this.host = host;
    const messages = this.getMessage(params.message).filter( line => {
      //コメント
      if (line.length > 0) {
        return (line[0].indexOf('//') != 0)
      }
      return false;
    });
    var cmd = [];

    const doCmd = (callback) => {
      if (cmd.length <= 0 || this.canceled) {
        callback();
        return;
      }
      const d = cmd.shift().trim();
      const page = d.match('(\\d+)page') || d.match('(\\d+)ページ');
      // var delay = d.match('(\\d+)s') || d.match('(\\d+)秒');
      var delay = d.match('(^([1-9]\\d*|0)(\\.\\d+)?)s$') || d.match('(^([1-9]\\d*|0)(\\.\\d+)?)秒$');
      if (delay == null) {
        // delay =  d.match('(\\d+)');
        delay = d.match('(^([1-9]\\d*|0)(\\.\\d+)?)');
      }
      var speed = d.match('(\\d+)speed') || d.match('(\\d+)スピード');
      if (speed == null) {
        speed = d.match('speed(\\d+)') || d.match('スピード(\\d+)');
      }
      var volume = d.match('(\\d+)volume') || d.match('(\\d+)音量');
      if (volume == null) {
        volume = d.match('volume(\\d+)') || d.match('音量(\\d+)');
      }
      if (d == 'next' || d.indexOf('次') >= 0) {
        this.nextPage(node, host, (err, res) => {
          if (err) {
            callback(err, 'ERR');
            return;
          }
          doCmd(callback);
        });
      } else
      if (d == 'prev' || d.indexOf('前') >= 0) {
        this.prevPage(node, host, (err, res) => {
          if (err) {
            callback(err, 'ERR');
            return;
          }
          doCmd(callback);
        });
      } else
      if (d == 'top' || d.indexOf('トップ') >= 0) {
        this.topPage(node, host, (err, res) => {
          if (err) {
            callback(err, 'ERR');
            return;
          }
          doCmd(callback);
        });
      } else
      if (d == 'quiz.question' || d.indexOf('クイズ.送信') >= 0) {
        this.quizCommand(node, host, {
          action: 'quiz',
          question: msg.quiz.question,
          choices: msg.quiz.choices,
          time: msg.quiz.timeLimit,
          pages: msg.quiz.pages,
          sideImage: msg.quiz.sideImage,
          answers: [],
        }, (err, res) => {
          if (err) {
            callback(err, 'ERR');
            return;
          }
          doCmd(callback);
        });
      } else
      if (d == 'quiz.start' || d.indexOf('クイズ.開始') >= 0 ||
          d == 'quiz.countdown' || d.indexOf('クイズ.カウントダウン') >= 0) {
        this.quizCommand(node, host, {
          action: 'start',
          question: msg.quiz.question,
          choices: msg.quiz.choices,
          time: msg.counter,
          answers: [],
        }, (err, res) => {
          if (err) {
            callback(err, 'ERR');
            return;
          }
          doCmd(callback);
        });
      } else
      if (d == 'quiz.answer' || d.indexOf('クイズ.解答') >= 0) {
        this.quizCommand(node, host, {
          action: 'answer',
          question: msg.quiz.question,
          choices: msg.quiz.choices,
          answers: msg.quiz.answers,
        }, (err, res) => {
          if (err) {
            callback(err, 'ERR');
            return;
          }
          doCmd(callback);
        });
      } else
      if (d == 'quiz.end' || d.indexOf('クイズ.終了') >= 0) {
        this.quizCommand(node, host, {
          action: 'wait',
        }, (err, res) => {
          if (err) {
            callback(err, 'ERR');
            return;
          }
          doCmd(callback);
        });
      } else
      if (d == 'quiz.timeup' || d.indexOf('クイズ.タイムアップ') >= 0) {
        this.quizCommand(node, host, {
          action: 'stop',
          question: msg.quiz.question,
          choices: msg.quiz.choices,
          time: 0,
          answers: [],
        }, (err, res) => {
          if (err) {
            callback(err, 'ERR');
            return;
          }
          doCmd(callback);
        });
      } else
      if (d.indexOf('quiz.slide') >= 0 || d.indexOf('クイズ.スライド') >= 0) {
        const m = d.match(/\/(.+)/);
        if (m) {
          this.quizCommand(node, host, {
            action: 'slide',
            photo: `${host}/${m[1]}`,
            pages: [],
          }, (err, res) => {
            if (err) {
              callback(err, 'ERR');
              return;
            }
            doCmd(callback);
          });
        } else {
          doCmd(callback);
        }
      } else
      if (d.indexOf('quiz.result') >= 0 || d.indexOf('クイズ.結果') >= 0) {
      } else
      if (d == 'marisa' || d.indexOf('魔理沙') >= 0) {
        params.voice = 'marisa';
        doCmd(callback);
      } else
      if (d == 'reimu' || d.indexOf('霊夢') >= 0) {
        params.voice = 'reimu';
        doCmd(callback);
      } else
      if (d == 'speed' || d.indexOf('スピード') >= 0) {
        params.speed = speed[1];
        doCmd(callback);
      } else
      if (d == 'volume' || d.indexOf('音量') >= 0) {
        params.volume = volume[1];
        doCmd(callback);
      } else
      if (d == 'left' || d.indexOf('左') >= 0) {
        params.direction = 'left';
        doCmd(callback);
      } else
      if (d == 'center' || d.indexOf('中') >= 0) {
        params.direction = 'center';
        doCmd(callback);
      } else
      if (d == 'right' || d.indexOf('右') >= 0) {
        params.direction = 'right';
        doCmd(callback);
      } else
      if (page !== null) {
        this.openPage(node, host, page[1], (err, res) => {
          if (err) {
            callback(err, 'ERR');
            return;
          }
          doCmd(callback);
        });
      } else
      if (delay !== null) {
        this.delay(parseFloat(delay[1]), (err, res) => {
          if (err) {
            callback(err, 'ERR');
            return;
          }
          doCmd(callback);
        });
      } else {
        doCmd(callback);
      }
    }

    function checkMessage(messages) {
      return messages.some( m => {
        return (m[0] != '');
      });
    }

    if (params.algorithm === 'shuffle') {
      const ptr = this.shufflePtr;
      var done = false;
      if (!checkMessage(messages)) {
        callback(null, '');
      } else {
        while (!this.canceled) {
          if (this.shufflePtr >= this.shuffle.length) {
            this.shufflePtr = 0;
            break;
          }
          let msg = messages[this.shuffle[this.shufflePtr]][0];
          if (msg == '') {
          } else {
            if (params.silence) {
              callback(null, msg);
            } else {
              this.textToSpeech(node, msg, host, params, (err, res) => {
                callback(err, msg);
              });
            }
            done = true;
          }
          this.shufflePtr++;
          if (this.shufflePtr >= this.shuffle.length) {
            this.doShuffle();
          }
          //一周するか発話したら終了
          if (ptr == this.shufflePtr || done) break;
        }
      }
    } else
    if (params.algorithm === 'random') {
      this.doShuffle();
      const ptr = this.shufflePtr;
      var done = false;
      if (!checkMessage(messages)) {
        callback(null, '');
      } else {
        while (!this.canceled) {
          if (this.shufflePtr >= this.shuffle.length) {
            this.shufflePtr = 0;
            break;
          }
          let msg = messages[this.shuffle[this.shufflePtr]][0];
          if (msg == '') {
          } else {
            if (params.silence) {
              callback(null, msg);
            } else {
              this.textToSpeech(node, msg, host, params, (err, res) => {
                callback(err, msg);
              });
            }
            done = true;
          }
          this.shufflePtr++;
          if (this.shufflePtr >= this.shuffle.length) {
            this.doShuffle();
          }
          //一周するか発話したら終了
          if (ptr == this.shufflePtr || done) break;
        }
      }
    } else
    if (params.algorithm === 'onetime') {
      const ptr = this.shufflePtr;
      var done = false;
      if (!checkMessage(messages)) {
        callback(null, '');
      } else {
        while (!this.canceled) {
          if (this.shufflePtr >= messages.length) {
            this.shufflePtr = 0;
            break;
          }
          let msg = messages[this.shufflePtr][0];
          if (msg == '') {
          } else {
            if (params.silence) {
              callback(null, msg);
            } else {
              this.textToSpeech(node, msg, host, params, (err, res) => {
                callback(err, msg);
              });
            }
            done = true;
          }
          this.shufflePtr++;
          if (this.shufflePtr >= this.shuffle.length) {
            this.doShuffle();
          }
          //一周するか発話したら終了
          if (ptr == this.shufflePtr || done) break;
        }
      }
    } else {
      var i = 0;
      const play = () => {
        if (i >= messages.length || this.canceled) {
          callback(null, 'OK');
          return;
        }
        var msg = '';
        cmd = [];
        for (;i<messages.length;i++) {
          if (messages[i][0] !== '') {
            if (msg !== '') msg += "\n";
            msg += messages[i][0];
          }
          if (messages[i].length > 1) {
            messages[i].forEach( v => {
              cmd.push(v);
            });
            cmd = cmd.slice(1);
            i++;
            break;
          }
        }
        node.log(cmd);
        if (msg == '') {
          if (cmd.length > 0) {
            doCmd(() => {
              play();
            });
          } else {
            play();
          }
        } else {
          if (params.silence) {
            if (cmd.length > 0) {
              doCmd(() => {
                play();
              });
            } else {
              play();
            }
          } else {
            this.textToSpeech(node, msg, host, params, (err, res) => {
              if (err) {
                callback(err, 'ERR');
                return;
              }
              if (cmd.length > 0) {
                doCmd(() => {
                  play();
                });
              } else {
                play();
              }
            });
          }
        }
      }
      play();
    }
  }
}

module.exports = function(RED) {
  "use strict";
  var net = require('net');
  var mustache = require("mustache");

  function getParams(param, config) {
    if (typeof config === 'undefined') {
      config = {};
    }
    if (typeof config.voice !== 'undefined' && config.voice !== 'keep') {
      param.voice = config.voice;
    }
    if (typeof config.speed !== 'undefined' && config.speed !== 'keep') {
      param.speed = config.speed;
    }
    if (typeof config.volume !== 'undefined' && config.volume !== 'keep') {
      param.volume = config.volume;
    }
    if (typeof config.tone !== 'undefined' && config.tone !== 'keep') {
      param.tone = config.tone;
    }
    if (typeof config.direction !== 'undefined' && config.direction !== 'keep') {
      param.direction = config.direction;
    }
    if (typeof config.silence !== 'undefined' && config.silence !== 'keep') {
      param.silence = config.silence;
    }
    if (typeof config.algorithm !== 'undefined' && config.algorithm !== 'keep') {
      param.algorithm = config.algorithm;
    }
    if (typeof config.sensitivity !== 'undefined' && config.sensitivity !== 'keep') {
      param.sensitivity = config.sensitivity;
    }
    return param;
  }

  function RobotListenerNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    var nodeUrl = config.host;
    var isTemplatedUrl = (nodeUrl||"").indexOf("{{") != -1;
    node.host = nodeUrl;
    //node.log(`${node.host}`);
    node.on("input", function(msg) {
      const id = getId(node, 'RobotListenerNode');
      var url = nodeUrl || msg.url;
      if (isTemplatedUrl) {
          url = mustache.render(nodeUrl, msg);
      }
      msg.robotHost = url;
      node.socket_info = {
        url, id,
      }
      const socket = createSocket(url, id, node, timeout(requestTimeout, (err, socket) => {
        if (err) {
          clearTimeout(node.socket_info.timeout);
          node.socket_info.timeout = null;
          removeSocket(url, id, node);
          node.send(msg);
          return;
        }
        node.socket_info.timeout = setTimeout(() => {
          node.socket_info.timeout = null;
          removeSocket(url, id, node);
        }, connectTimeout);
        node.send(msg);
      }));
    });
    node.on('close', function(removed, done) {
      removeSocket(node.socket_info.url, node.socket_info.id, node);
      if (node.socket_info.timeout) {
        clearTimeout(node.socket_info.timeout);
        node.socket_info.timeout = null;
      }
      done();
    });
  }
  RED.nodes.registerType("robot-listener",RobotListenerNode);

  function VoiceNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    var params = {};
    node.on("input", function(msg) {
      params = getParams(params, msg.robotParams);
      params = getParams(params, config);
      msg.robotParams = params;
      node.send(msg);
    });
    node.on('close', function(removed, done) {
      done();
    });
  }
  RED.nodes.registerType("robot-voice",VoiceNode);

  //HTTPによる接続
  function _request_http(node, action, host, body, callback) {
    request({
      method: 'POST',
      uri: `${host}/${action}`,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }, function(err, res, body) {
      callback(err, body);
    });
  }

  function TextToSpeechNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.algorithmPlay = new Play();
    var params = {};
    node.on("input", function(msg) {
      node.playing = true;
      node.status({fill:"blue",shape:"dot"});
      params.message = msg.payload;
      params = getParams(params, msg.robotParams);
      params = getParams(params, config);
      node.algorithmPlay.request(node, msg, params, function(err, res) {
        if (!node.playing) return;
        node.log(res);
        msg.result = res;
        node.send(msg);
        node.status({});
      });
    });
    node.on('close', function(removed, done) {
      node.playing = false;
      node.algorithmPlay.stop(node);
      node.status({});
      done();
    });
  }
  RED.nodes.registerType("text-to-speech",TextToSpeechNode);

  function SpeechToTextNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    var param = {};
    if (typeof config.timeout !== 'undefined') {
      param.timeout = config.timeout;
    }
    if (typeof config.sensitivity !== 'undefined') {
      param.sensitivity = config.sensitivity;
    }
    node.on("input", function(msg) {
      node.recording = true;
      node.status({fill:"blue",shape:"dot"});
      node.robotHost = msg.robotHost;
      _request(node, 'speech-to-text', msg.robotHost, param, function(err, res) {
        if (!node.recording) return;
        node.recording = false;
        node.log(res);
        if (res == '[timeout]') {
          msg.payload = 'timeout';
          node.send([null, msg]);
        } else
        if (res == '[canceled]') {
          msg.payload = 'canceled';
          node.send([null, msg]);
        } else
        if (res == '[camera]') {
          msg.payload = 'camera';
          node.send([null, msg]);
        } else {
          if (res.button) {
            msg.payload = 'button';
            msg.button = res;
            delete res.button;
            node.send([null, msg]);
          } else
          if (res.speechRequest) {
            msg.speechRequest = true;
            msg.payload = res.payload;
            node.send([msg, null]);
          } else
          if (typeof res === 'object') {
            msg.languageCode = res.languageCode,
            msg.confidence = res.confidence;
            msg.payload = res.transcript;
            node.send([msg, null]);
          } else {
            msg.payload = res;
            delete msg.speechRequest;
            node.send([msg, null]);
          }
        }
        node.status({});
      });
    });
    node.on('close', function(removed, done) {
      node.recording = false;
      _request(node, 'stop-speech-to-text', node.robotHost, {});
      node.status({});
      done();
    });
  }
  RED.nodes.registerType("speech-to-text",SpeechToTextNode);

  function UtteranceNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.algorithmPlay = new Play();
    var params = {};
    var utterance = config.utterance;
    var isTemplatedUrl = (utterance||"").indexOf("{{") != -1;
    node.utterance = utterance;
    node.on("input", function(msg) {
      node.playing = true;
      node.status({fill:"blue",shape:"dot"});
      params.message = node.utterance;
      if (isTemplatedUrl) {
          params.message = mustache.render(node.utterance, msg);
      }
      params = getParams(params, msg.robotParams);
      params = getParams(params, config);
      node.algorithmPlay.request(node, msg, params, function(err, res) {
        if (!node.playing) return;
        node.log(res);
        msg.result = res;
        msg.payload = params.message;
        node.send(msg);
        node.status({});
      });
    });
    node.on('close', function(removed, done) {
      node.playing = false;
      node.algorithmPlay.stop(node);
      node.status({});
      done();
    });
  }
  RED.nodes.registerType("utterance",UtteranceNode);

  function DocomoChatNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    var params = {};
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      params.message = msg.payload;
      params = getParams(params, msg.robotParams);
      params = getParams(params, config);
      _request(node, 'docomo-chat', msg.robotHost, params, function(err, res) {
        msg.result = msg.payload;
        msg.payload = res;
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
    node.on('close', function(removed, done) {
      done();
      node.status({});
    });
  }
  RED.nodes.registerType("chat",DocomoChatNode);

  function CommandNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'command', msg.robotHost, {
        command: config.command,
        args: config.args,
      }, function(err, res) {
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
    node.on('close', function(removed, done) {
      done();
      node.status({});
    });
  }
  RED.nodes.registerType("command",CommandNode);

  function OpenSlideNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'command', msg.robotHost, {
        command: 'open-slide.cmd',
        args: config.args,
      }, function(err, res) {
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
    node.on('close', function(removed, done) {
      done();
      node.status({});
    });
  }
  RED.nodes.registerType("open-slide",OpenSlideNode);

  function NextPageNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'command', msg.robotHost, {
        command: 'right-key.cmd',
        args: '',
      }, function(err, res) {
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
    node.on('close', function(removed, done) {
      done();
      node.status({});
    });
  }
  RED.nodes.registerType("next-page",NextPageNode);

  function CloseSlideNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      _request(node, 'command', msg.robotHost, {
        command: 'done-key.cmd',
        args: '',
      }, function(err, res) {
        node.log(res);
        node.send(msg);
        node.status({});
      });
    });
    node.on('close', function(removed, done) {
      done();
      node.status({});
    });
  }
  RED.nodes.registerType("close-slide",CloseSlideNode);

  function MecabNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    var isTemplatedUrl = (config.pattern||"").indexOf("{{") != -1;
    if (typeof config.intent === 'undefined') {
      node.intent = '';
    } else {
      node.intent = config.intent;
    }
    if (typeof config.priority === 'undefined') {
      //node.priority =　0;
    } else {
      node.priority = config.priority;
    }
    const wireNum = config.wires[1].length;
    node.on("input", function(msg) {
      if (config.pattern) {
        var pattern = config.pattern;
        if (isTemplatedUrl) {
            pattern = mustache.render(config.pattern, msg);
        }
        node.pattern = pattern.split('\n').filter( v => v != '' );
      } else {
        node.pattern = [];
      }
      node.status({fill:"blue",shape:"dot"});
      mecab_proc(msg.payload, [ [node.intent, node.pattern], ] , function(err, res) {
        //node.log(res);
        msg.subject = res.subject;
        msg.subjects = res.subjects;
        if (res.intent !== '') {
          msg.intent = res.intent;
        }
        if (res.match) {
          if (typeof node.priority !== 'undefined') {
            if (typeof msg.topicPriority === 'undefined') {
              msg.topicPriority = 0;
            }
            msg.topicPriority = msg.topicPriority + parseInt(node.priority);
          }
        }
        if (wireNum > 0) {
          if (res.match) {
            node.send([msg, null]);
          } else {
            node.send([null, msg]);
          }
        } else {
          node.send([msg, null]);
        }
        node.status({});
      });
    });
    node.on('close', function(removed, done) {
      done();
      node.status({});
    });
  }
  RED.nodes.registerType("mecab",MecabNode);

  function TopicForkNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    const wireNum = config.wires[0].length;
    node.on("input", function(msg) {
      msg.topicId = (function(){
          var S4 = function() {
              return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
          };
          return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4() +S4());
      })();
      msg.topic = node.context().global.get('topic');
      if (typeof node.context().global.get('topicForks') === 'undefined') {
        node.context().global.set('topicForks',{});
      }
      const topicForks = node.context().global.get('topicForks');
      topicForks[msg.topicId] = { count: node.wires[0].length, priority: 0, name: "", msg: {} };
      node.context().global.set('topicForks', topicForks);
      node.status({fill:"blue",shape:"dot"});
      node.send(msg);
      node.status({});
    });
    node.on("close", function() {
      node.status({});
    });
  }
  RED.nodes.registerType("topic-fork",TopicForkNode);

  function TopicJoinNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      // console.log(JSON.stringify(msg, null, '  '));
      // console.log(msg.topicId);
      node.status({fill:"blue",shape:"dot"});
      while (true) {
        if (typeof node.context().global.get('topicForks') !== 'undefined' && typeof msg.topicId !== 'undefined') {
          const topicForks = node.context().global.get('topicForks');
          topicForks[msg.topicId].count --;
          // console.log(`msg.topicName ${msg.topicName}`);
          if (typeof msg.topicPriority !== 'undefined' && topicForks[msg.topicId].priority < msg.topicPriority) {
            topicForks[msg.topicId].priority = msg.topicPriority;
            topicForks[msg.topicId].name = msg.topicName;
            topicForks[msg.topicId].msg = msg;
          }
          node.context().global.set('topicForks', topicForks);
          if (topicForks[msg.topicId].count <= 0) {
            if (typeof topicForks[msg.topicId].msg.topicName !== 'undefined' && topicForks[msg.topicId].msg.topicPriority !== 0) {
              node.context().global.set('topic', topicForks[msg.topicId].msg.topicName);
              topicForks[msg.topicId].msg.topic = topicForks[msg.topicId].msg.topicName;
              node.send(topicForks[msg.topicId].msg);
            } else {
              //node.context().global.set('topic', null);
              if (msg.topicPriority === 0) {
                delete msg.topicName;
              }
              node.send(msg);
            }
            // console.log(JSON.stringify(msg, null, '  '));
            // console.log(JSON.stringify(topicForks[msg.topicId].msg, null, '  '));
            break;
          }
        }
        node.send(null);
        break;
      }
      node.status({});
    });
    node.on("close", function() {
      node.status({});
    });
  }
  RED.nodes.registerType("topic-join",TopicJoinNode);

  function TopicPriorityNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      if (typeof msg.topicPriority === 'undefined') {
        msg.topicPriority = 0;
      }
      msg.topicPriority = msg.topicPriority + parseInt(config.priority);
      node.send(msg);
      node.status({});
    });
    node.on("close", function() {
      node.status({});
    });
  }
  RED.nodes.registerType("topic-priority",TopicPriorityNode);

  function TopicNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      msg.topicName = config.topic;
      msg.topicPriority = (typeof msg.topicPriority !== 'undefined') ? msg.topicPriority : 0;
      node.send(msg);
      node.status({});
    });
    node.on("close", function() {
      node.status({});
    });
  }
  RED.nodes.registerType("topic",TopicNode);

  function RepeatNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    node.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      if (!msg.hasOwnProperty('_loopController') || msg._loopController.id !== this.id) {
        msg._loopController = {
          loops: 0,
          remaining: msg.repetitions || config.repetitions,
          id: this.id
        };
      }
      if (msg._loopController.remaining > 0) {
        msg._loopController.remaining -= 1;
        msg._loopController.loops += 1;
        if (config.step === 'inc') {
          msg.counter = msg._loopController.loops;
        } else {
          msg.counter = msg._loopController.remaining;
        }
        node.send(msg);
        node.status({});
      } else {
        node.send([null, msg]);
        node.status({});
      }
    });
    node.on("close", function() {
      node.status({});
    });
  }
  RED.nodes.registerType("repeat",RepeatNode);

  function QuizButtonNode(config) {
    RED.nodes.createNode(this,config);
    var node = this;
    var param = {};
    if (typeof config.timeout !== 'undefined') {
      param.timeout = config.timeout;
    }
    node.on("input", function(msg) {
      node.recording = true;
      node.status({fill:"blue",shape:"dot"});
      node.robotHost = msg.robotHost;
      _request(node, 'quiz-button', msg.robotHost, param, function(err, res) {
        if (!node.recording) return;
        node.recording = false;
        node.log(res);
        if (res == '[timeout]') {
          msg.payload = 'timeout';
          node.send([null, msg]);
        } else
        if (res == '[canceled]') {
          msg.payload = 'canceled';
          node.send([null, msg]);
        } else {
          msg.button = res;
          node.send([msg, null]);
        }
        node.status({});
      });
    });
    node.on('close', function(removed, done) {
      node.recording = false;
      _request(node, 'stop-quiz-button', node.robotHost, {});
      node.status({});
      done();
    });
  }
  RED.nodes.registerType("quiz-button",QuizButtonNode);

}
