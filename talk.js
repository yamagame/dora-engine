const EventEmitter = require('events');
const spawn = require('child_process').spawn;
const path = require('path');
const macvoice_speedrate = 180 / 100;
const config = reqire('config');
const request = require('request');

function Talk() {
	var t = new EventEmitter();
	t.playQue = [];
	t.playing = false;
	t.voice = 'reimu';
	t.speed = 95;
	t.volume = 80;
	t.dummy = false;
	t.macvoice = false;
	t.language = null;

  t.say = function(words, params, callback) {
    if (typeof words === 'undefined') {
      callback();
      return;
    }
  	const voice = params.voice;
  	const speed = params.speed;
  	const volume = params.volume;
		const language = params.language;
    const conts = words.split(/\n|,|、|。|@|＠|？|\s|\?/g);
    const playone = () => {
      if (conts.length <= 0 || this.playing === false) {
        callback();
        return;
      }
      const text = conts.shift();
  		if (text == '') {
  			playone();
  			return;
  		}
      console.log(text);
			if (language === 'default' || language === null) {
				if (this.dummy) {
					playone();
				} else if (this.macvoice) {
					if (voice == 'marisa') {
						const _playone = spawn(path.join(__dirname, 'talk-mac-Otoya.sh'), [`-r`, speed * macvoice_speedrate, `　${text}`]);
						_playone.on('close', function (code) {
							playone();
						});
					} else {
						const _playone = spawn(path.join(__dirname, 'talk-mac-Kyoko.sh'), [`-r`, speed * macvoice_speedrate, `　${text}`]);
						_playone.on('close', function (code) {
							playone();
						});
					}
				} else {
					if (voice == 'marisa') {
						const _playone = spawn(path.join(__dirname,'talk-f2.sh'), [`-s`, speed, `-g`, volume, `　${text}`]);
						_playone.on('close', function(code) {
							playone();
						});
					} else {
						const _playone = spawn(path.join(__dirname,'talk-f1.sh'), [`-s`, speed, `-g`, volume, `　${text}`]);
						_playone.on('close', function(code) {
							playone();
						});
					}
				}
			} else
			if (language) {
				request({
					uri: `http://localhost:${config.port}/google/text-to-speech`,
					method: 'POST',
					json: {
						languageCode: language,
						text,
					},
				},
				function (error, response, body) {
			    playone();
				});
			} else {
		    playone();
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
		if (!params.language) params.language = t.language;
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
