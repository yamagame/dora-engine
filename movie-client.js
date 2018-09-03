const io = require('socket.io-client');
const EventEmitter = require('events');
const player = require('./movie-player');
const path = require('path');
const ping = require('ping');
const config = require('./config');
const mkdirp = require('mkdirp');
const fs = require('fs');

const workFolder = 'DoraEngine';  //for macOS(development)
const PICT = (process.platform === 'darwin') ? path.join(process.env.HOME, 'Pictures', workFolder) : path.join(process.env.HOME, 'Pictures');
const PORT = process.argv[3] || config.server_port;

const imageServer = true;  //画像サーバーとして機能させるときはここをtrueにする

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request-promise');

const host = process.argv[2] || 'localhost';

function MovieClient(host, callback) {
  var t = new EventEmitter();

  const login = async (callback) => {
    try {
      const body = await request({
        uri: `http://${host}:${config.port}/login-guest-client`,
        method: 'POST',
        json: {
          username: 'guest-client',
          password: process.env.ROBOT_GUEST_CLIENT_ACCESS_KEY || 'guestclientnopass',
        },
      });
      callback(null, body);
    } catch(err) {
      callback(err, null);
    }
  }
  login((err, payload) => {
    if (err) {
      callback(err, null);
      return;
    }
    const socket = io(`http://${host}:${config.port}/player`);
    socket.on('connect', function(){
      console.log('connect', socket.id);
      if (imageServer) {
        socket.emit('notify', {
          role: 'imageServer',
          port: PORT,
          protocol: 'http',
          ...payload,
        });
      }
    });
    socket.on('movie', function(data, callback){
      if (data.action === 'play') {
        const p = path.join(__dirname, '../Videos', data.movie);
        fs.stat(p, (err, stats) => {
          if (!err && stats.isFile()) {
            player.play(p);
          } else {
            player.play(path.join(__dirname, '../Movie', data.movie));
          }
        });
      } else if (data.action === 'check') {
        if (callback) callback({ state: player.state });
        return;
      } else if (data.action === 'cancel') {
        player.emit('cancel');
      }
      if (callback) callback({ state: player.state });
    });
    socket.on('disconnect', function(){
      console.log('disconnected');
    });
    player.on('done', function () {
      socket.emit('done');
    });
  });

  return t;
}

if (imageServer) {
  const app = express()

  app.use((req, res, next) => {
    console.log(`# ${(new Date()).toLocaleString()} ${req.ip} ${req.url}`);
    next();
  });

  app.use(bodyParser.json({ type: 'application/json' }))
  app.use(bodyParser.raw({ type: 'application/*' }))

  app.use('/images', express.static(PICT))

  const server = require('http').Server(app);

  server.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`))
}

module.exports = MovieClient;

if (require.main === module) {
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
  ipResolver(host, (res) => {
    console.log(`start movie clinet ${res.numeric_host}`);
    const t = MovieClient(host, (err) => {
      if (err) console.error(`${err.name}: ${err.statusCode} - ${err.error}`);
    });
  })
}
