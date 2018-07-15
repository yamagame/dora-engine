const EventEmitter = require('events');
const spawn = require('child_process').spawn;
const path = require('path');
const macvoice_speedrate = 180 / 100;

function Talk() {
	var t = new EventEmitter();
	t.playQue = [];
	t.playing = false;
	t.voice = 'reimu';
	t.speed = 95;
	t.volume = 80;
	t.dummy = false;
	t.macvoice = false;

  t.say = function(words, params, callback) {
    if (typeof words === 'undefined') {
      callback();
      return;
    }
  	const voice = params.voice;
  	const speed = params.speed;
  	const volume = params.volume;
    const conts = words.split(/\n|,|、|。|@|＠|？|\s|\?/g);
    const playone = () => {
      if (conts.length <= 0 || this.playing === false) {
        callback();
        return;
      }
      const cont = conts.shift();
  		if (cont == '') {
  			playone();
  			return;
  		}
      console.log(cont);
			if (this.dummy) {
				playone();
			} else if (this.macvoice) {
				if (voice == 'marisa') {
					const _playone = spawn(path.join(__dirname, 'talk-mac-Otoya.sh'), [`-r`, speed * macvoice_speedrate, `　${cont}`]);
					_playone.on('close', function (code) {
						playone();
					});
				} else {
					const _playone = spawn(path.join(__dirname, 'talk-mac-Kyoko.sh'), [`-r`, speed * macvoice_speedrate, `　${cont}`]);
					_playone.on('close', function (code) {
						playone();
					});
				}
			} else {
				if (voice == 'marisa') {
					const _playone = spawn(path.join(__dirname,'talk-f2.sh'), [`-s`, speed, `-g`, volume, `　${cont}`]);
					_playone.on('close', function(code) {
						playone();
					});
				} else {
					const _playone = spawn(path.join(__dirname,'talk-f1.sh'), [`-s`, speed, `-g`, volume, `　${cont}`]);
					_playone.on('close', function(code) {
						playone();
					});
				}
			}
    }
    playone();
  }

  t.playAsync = function(speech, params) {
    return new Promise( (resolve) => {
      this.say(speech, params, () => {
        resolve(null, 'OK');
      });
    });
  }

	t.play = function(sentence, params = {}, callback) {
		if (!params.voice) params.voice = t.voice;
		if (!params.speed) params.speed = t.speed;
		if (!params.volume) params.volume = t.volume;
		this.emit('talk');
		if (!this.playing) {
			this.playing = true;
			const _play = (sentence) => {
  			this.playAsync(sentence, params).then(() => {
  				if (this.playQue.length > 0 && this.playing !== false) {
  					const sentence = this.playQue.shift();
  					_play(sentence);
  				} else {
  				  this.playQue = [];
  					this.playing = false;
  					this.emit('idle');
  					if (callback) callback();
  				}
  			});
			}
			_play(sentence);
		} else {
			this.playQue.push(sentence);
		}
	}

	t.stop = function() {
	}

	t.flush = function() {
    this.playing = false;
		this.playQue = [];
	}

	return t;
}

module.exports = Talk();
