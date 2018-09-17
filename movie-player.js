const EventEmitter = require('events');
const spawn = require('child_process').spawn;
const path = require('path');
const util = require('./util');

function Player() {
  var t = new EventEmitter();

  t.state = 'idle';

  t.play = function (moviefilepath) {
    if (process.platform === 'darwin') {
      var _play = spawn(path.join(__dirname, 'movie-play-mac.scpt'), [moviefilepath]);
    } else {
      var _play = spawn('/usr/bin/omxplayer', ['--no-osd', moviefilepath]);
    }
    t.state = 'play';
    _play.on('close', function (code) {
      t.state = 'idle';
      t.removeListener('cancel', cancel);
      t.emit('done');
    });
    function cancel() {
      util.kill(_play.pid, 'SIGTERM', function () {
      });
      t.removeListener('cancel', cancel);
    }
    t.on('cancel', cancel);
  }

  return t;
}

const player = Player();
module.exports = player;

if (require.main === module) {
  player.play(process.argv[2]);
  player.on('done', function () {
    console.log('done');
  });
}
