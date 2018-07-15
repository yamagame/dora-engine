const EventEmitter = require('events');
const spawn = require('child_process').spawn;
const path = require('path');
const psTree = require('ps-tree');

var kill = function (pid, signal, callback) {
  signal   = signal || 'SIGKILL';
  callback = callback || function () {};
  var killTree = true;
  if(killTree) {
    psTree(pid, function (err, children) {
      [pid].concat(
        children.map(function (p) {
          return p.PID;
        })
      ).forEach(function (tpid) {
        try { process.kill(tpid, signal) }
        catch (ex) { }
      });
      callback();
    });
  } else {
    try { process.kill(pid, signal) }
    catch (ex) { }
    callback();
  }
};

function Player() {
  var t = new EventEmitter();
  
  t.state = 'idle';
  
  t.play = function(path) {
		const _play = spawn('/usr/bin/omxplayer', ['--no-osd', path]);
		t.state = 'play';
		_play.on('close', function(code) {
  		t.state = 'idle';
		  t.removeListener('cancel', cancel);
		  t.emit('done');
		});
    function cancel() {
      kill(_play.pid,'SIGTERM',function() {
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
