const io = require('socket.io-client');
const EventEmitter = require('events');
const ping = require('ping');

const clients = [
  {
    host:'button01.local',
    port: 3090,
    name:'button01',
    team:'くまさん',
  },
  {
    host:'button02.local',
    port: 3090,
    name:'button02',
    team:'うさぎさん',
  },
  {
    host:'button03.local',
    port: 3090,
    name:'button03',
    team:'かめさん',
  },
  {
    host:'button04.local',
    port: 3090,
    name:'button04',
    team:'かえるさん',
  },
  {
    host:'button05.local',
    port: 3090,
    name:'button05',
    team:'きりんさん',
  },
  {
    host:'http://localhost:3090',
    name:'master',
    team:'マスター',
    localhost: true,
  },
]

function ipResolver(host, callback) {
  function _resolve() {
    ping.promise.probe(host)
    .then(function (res) {
      if (res.alive) {
        callback(res);
      } else {
        setTimeout(() => {
          _resolve()
        }, 1000);
      }
    });
  }
  _resolve();
}

function ButtonClient() {
  var bright = 1;
  var buttons = {};
  var clientSocket = {};
  var led_mode = 'blink';
  var led_name = '';
  var blinkSpeed = 0.025;
  var theta = 0;
  
  var t = new EventEmitter();

  function sendCommand() {
    if (led_mode == 'on') {
      Object.keys(buttons).forEach( key => {
        const button = buttons[key];
        if (button.socket && !button.localhost) {
          button.socket.emit('led-command', { action: 'on', value: bright });
        }
      });
    } else
    if (led_mode == 'off') {
      Object.keys(buttons).forEach( key => {
        const button = buttons[key];
        if (buttons[key].socket && !button.localhost) {
          buttons[key].socket.emit('led-command', { action: 'off', value: bright });
        }
      });
    } else
    if (led_mode == 'blink') {
      bright = (Math.sin(theta)+1)/2;
      theta += blinkSpeed*10;
      if (theta >= Math.PI*2) {
        theta -= Math.PI*2;
      }
      Object.keys(buttons).forEach( key => {
        const button = buttons[key];
        if (button.socket && !button.localhost) {
          button.socket.emit('led-command', { action: 'on', value: bright });
        }
      });
    } else
    if (led_mode == 'one') {
      Object.keys(buttons).forEach( key => {
        const button = buttons[key];
        if (button.socket && !button.localhost) {
          if (button.name == led_name) {
            button.socket.emit('led-command', { action: 'on', value: bright });
          } else {
            button.socket.emit('led-command', { action: 'off', value: bright });
          }
        }
      });
    }
  }

  clients.forEach( client => {
    const connect = (client) => {
      ipResolver(client.host, (res) => {
        console.log(`found button ${client.host} ${res.numeric_host}`);
        const host = `http://${res.numeric_host}:${client.port}`;
        const socket = io(host);
        clientSocket[client.name] = {
          ...client,
          socket: socket,
        }
        var id = null;
        socket.on('connect', function() {
          console.log('connect', socket.id, host);
          id = socket.id;
          buttons[socket.id] = {
            socket,
            ...client,
          }
          sendCommand();
        });
        socket.on('button', function(data){
          t.emit('button', { ...client, });
        });
        socket.on('speech', function(data){
          t.emit('speech', { ...client, data });
        });
        socket.on('disconnect', function(){
          console.log('disconnect', id);
          delete buttons[id];
          socket.close();
          connect(client);
        });
      })
    }
    connect(client);
  });

  //全ボタン待機
  t.on('all-blink', (paylaod) => {
    led_mode = 'blink';
  });

  //全ボタンオン
  t.on('all-on', (payload) => {
    led_mode = 'on';
    bright = (typeof payload.bright) ? payload.bright : bright;
  });

  //全ボタンオフ
  t.on('all-off', (payload) => {
    led_mode = 'off';
  });

  //一つだけオン
  t.on('one', (payload) => {
    led_mode = 'one';
    led_name = payload.name;
    bright = (typeof payload.bright) ? payload.bright : bright;
  });

  //明るさ
  t.on('bright', (payload) => {
    bright = (typeof payload.bright) ? payload.bright : bright;
  });

  //音再生
  t.on('sound', (payload) => {
    Object.keys(clientSocket).forEach( key => {
      const button = clientSocket[key];
      if (button.socket) {
        button.socket.emit('sound-command', { sound: payload.sound });
      }
    });
  });

  //音声認識停止
  t.on('stop-speech-to-text', () => {
    Object.keys(clientSocket).forEach( key => {
      const button = clientSocket[key];
      if (button.socket && !button.localhost) {
        button.socket.emit('stop-speech-to-text');
      }
    });
  });

  //コマンド実行
  t.doCommand = function(payload) {
    if (payload.type == 'button') {
      t.emit(payload.action, payload);
      sendCommand();
    }
  }

  setInterval(() => {
    sendCommand();
  }, 200);

  t.socket = function(name) {
    return clientSocket[name].socket;
  }

  return t;
}

module.exports = ButtonClient;

if (require.main === module) {
  const t = ButtonClient();
  // t.emit('all-on');
}
