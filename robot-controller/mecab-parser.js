const MeCab = new require('mecab-async');
MeCab.command = 'mecab';
const mecab = new MeCab();
const sentense = process.argv[2] || "こんにちは";

/*
@	名詞
~	動詞(非自立)
^	動詞(自立)
$	助詞
%	助動詞
#	形容詞
.	副詞
!	感動詞
&	連体詞
+	接続詞
*/

const parseNet = (mecab) => {
  const result = mecab.map( v => v );
  var ret = [];
  var wda = [];
  var pre = null;
  var kana = true;
  const _getWord = (a,n) => {
    var word = a[0];
    if (a.length > n) {
      word = a[n];
    }
    if (!word.match(/^[\u30A0-\u30FF]+$/)) {
      kana = false;
    }
    return word;
  }
  const _parseNet = () => {
    while (true) {
      if (result.length <= 0) {
        ret.push('=');
        wda.push('');
        return { net: mecab, form: ret, text: wda };
      }
      var c = result.shift();
      if (c[1] == '名詞') {
        ret.push(`@${_getWord(c,8)}`);
        wda.push(c[0]);
        pre = c;
      } else
      if (c[1] == '動詞') {
        if (c[2] == '非自立') {
          ret.push(`~${_getWord(c,8)}`);
        } else {
          ret.push(`^${_getWord(c,7)}`);
        }
        wda.push(c[0]);
        pre = c;
      } else
      if (c[1] == '助詞') {
        ret.push(`$${_getWord(c,8)}`);
        wda.push(c[0]);
        pre = c;
      } else
      if (c[1] == '助動詞') {
        ret.push(`%${_getWord(c,8)}`);
        wda.push(c[0]);
        pre = c;
      } else
      if (c[1] == '形容詞') {
        ret.push(`#${_getWord(c,8)}`);
        wda.push(c[0]);
        pre = c;
      } else
      if (c[1] == '副詞') {
        ret.push(`.${_getWord(c,8)}`);
        wda.push(c[0]);
        pre = c;
      } else
      if (c[1] == '感動詞') {
        ret.push(`!${_getWord(c,8)}`);
        wda.push(c[0]);
        pre = c;
      } else
      if (c[1] == '連体詞') {
        ret.push(`&${_getWord(c,8)}`);
        wda.push(c[0]);
        pre = c;
      } else
      if (c[1] == '接続詞') {
        ret.push(`+${_getWord(c,8)}`);
        wda.push(c[0]);
        pre = c;
      } else
      if (c[1] == '記号') {
        pre = c;
      } else {
        pre = c;
      }
    }
  }
  return _parseNet();
}

function Sentence(net) {
  this.net = net;
  if (this.net.form[this.net.form.length-1] != '=') {
    this.net.form.push('=');
    this.net.text.push('');
  }

  this._parsePattern = function(pattern) {
    var step = 0;
    var r = [];
    var t = '';
    for (var i=0;i<pattern.length;i++) {
      switch (step) {
      case 0:
        if (pattern[i].match(/[\(\$\%\@\~\^\=\#\.\!\&]/)) {
          if (t.length > 0) r.push({t,s:-1,n:0});
          t = '';
        }
        break;
      }
      t += pattern[i];
    }
    if (t.length > 0) r.push({t,s:-1,n:0});
    return r;
  }

  this.match = function(pattern) {
    try {
      const pat = this._parsePattern(pattern);

      var _j=0;
      var j=0;
      var tag = null;
      var last = null;
      var found = false;
      var cancel = false;
      (function(){
        for (n=0;n<pat.length;n++) {
          var v = pat[n].t;
          var m = v.match(/^\((.+)\)$/);
          if (m) {
            pat[n].v = m[1];
          } else {
            last = n+1;
          }
        }
      })();
      const nextPattern = () => {
        for (var n=j;n<pat.length;n++) {
          const v = pat[n].t;
          if (pat[n].v == null) {
            j = n + 1;
            return v;
          }
        }
        found = false;
        j = n;
        return null;
      }

      pat.forEach( (_p, _j) => {
        const j = pat.length-1-_j;
        const p = pat[j];
        if (p.v) {
          if (_j == 0) {
            p.s = 0;
          } else {
            p.s = pat[j+1].s;
          }
        } else {
          this.net.form.forEach( (v, i) => {
            if (v == p.t && (_j == 0 || i < pat[j+1].s)) {
              p.n = 1;
              p.s = i;
            }
          });
        }
      });

      pat.forEach( (p,j) => {
        if (p.v) {
          if (j > 0) {
            p.s = pat[j-1].s+pat[j-1].n;
          } else {
            p.s = 0;
          }
          if (j < pat.length-1) {
            p.n = pat[j+1].s-p.s;
          }
        }
      });

      const r = {};
      pat.some( p => {
        if (p.s < 0) {
          cancel = true;
          return true;
        }
        if (p.v) {
          r[p.v] = new Sentence({
            form: this.net.form.slice(p.s,p.s+p.n),
            text: this.net.text.slice(p.s,p.s+p.n),
            net: this.net.net.slice(p.s,p.s+p.n),
          });
        }
      });

      if (!cancel) {
        this._result = r;
        return r;
      }
      this._result = null;

      return null;
    } catch(err) {
      console.error(err);
    }
    this._result = null;
    return null;
  }
  
  return this;
}

Sentence.prototype.toString = function() {
  return JSON.stringify(this.net, null, '  ');
}

module.exports = function(sentense, callback) {
  mecab.parse(sentense, (err, result) => {
    const word = new Sentence(parseNet(result));
    callback(err, word);
  });
}

if (require.main === module) {
  mecab.parse(sentense, (err, result) => {
    const word = Sentence(parseNet(result));
    console.log(word.net.form.join(''));
    if (process.argv[3]) {
      //'(subject)^教える$テ(last)='
      const ret = word.match(process.argv[3]);
      if (ret) {
        if (ret.subject) console.log(ret.subject.net.form.join(''));
        if (ret.last) console.log(ret.last.net.form.join(''));
      }
    }
  });
}
