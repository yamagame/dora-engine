const MeCab = new require('mecab-async');
MeCab.command = 'mecab';
const mecab = new MeCab();

const generate = (sentense) => {
  const node = () => {
    const n = { p: null, c:[], v: [], s: [], };
    return n;
  }
  const tree = (str) => {
    let order = 0;
    let n = top = node();
    let stack = [];
    while (str.length > 0) {
      const ch = str.slice(0,1);
      str = str.slice(1);
      if (ch[0] == '[') {
        const q = node();
        const p = node()
        p.p = q;
        q.v.push(p);
        q.p = n;
        n.c.push(q);
        n = p;
      } else
      if (ch[0] == '|') {
        const q = n.p;
        const p = node()
        p.p = q;
        q.v.push(p);
        n = p;
      } else
      if (ch[0] == ']') {
        const p = n.p.p;
        const t = node()
        t.p = p;
        p.c.push(t);
        n = t;
      } else {
        if (!n.o) {
          n.o = order;
          order ++;
        }
        n.s.push(ch[0]);
      }
    }
    const removeP = (n) => {
      delete n.p;
      if (n.c) {
        for(var i=0;i<n.c.length;i++) {
          const q = removeP(n.c[i]);
        }
        for(var i=0;i<n.v.length;i++) {
          const q = removeP(n.v[i]);
        }
      }
    }
    removeP(top);
    return { top };
  }
  const n = tree(sentense);
  let m = 1;
  let r = [{ s:'', d: 0 }];
  const trace = (n, flag, dep) => {
    if (n.v.length > 0) {
      m *= n.v.length;
    }

    let s = n.s.join('');

    if (flag) {
      if (n.v.length > 0) {
        const t = [];
        n.v.forEach( v => {
          if (v.c.length > 0) {
            t.push({ s: v.s.join(''), d: dep+1, });
          } else {
            t.push({ s: v.s.join(''), d: dep, });
          }
        })
        const f = [];
        const g = [];
        r.forEach( a => {
          if (a.d === dep) {
            f.push(a);
          } else {
            g.push(a);
          }
        })
        const q = [];
        g.forEach( v => {
          q.push( v );
        })
        t.forEach( a => {
          f.forEach( b => {
            q.push({ s: b.s+a.s, d: a.d, })
          })
        })
        r = q;
      } else {
        r = r.map( v => {
          if (v.d >= dep) {
            return { s: v.s+s, d: dep, };
          } else {
            return v;
          }
        })
      }
    }

    n.v.forEach( v => {
      trace(v, false, dep+1);
    })
    n.c.forEach( c => {
      trace(c, true, dep);
    })
  }
  trace(n.top, true, 0);
  return r.map( v => v.s );
}

const parse = (str) => {
  let ptr = 0;
  words = [''];
  while (str.length > 0) {
    const ch = str.slice(0,1);
    str = str.slice(1);
    if (ch[0] == '(') {
      words.push('');
      ptr ++;
    } else
    if (ch[0] == ')') {
      ptr --;
    } else {
      if (ptr > 0) {
        const last = words.length-1;
        words[last] = words[last]+ch[0];
      }
      words[0] = words[0]+ch[0];
    }
  }
  return words
}

const compare = (s1, s2) => {
  const getword = (s1) => {
    const t1 = [];
    s1.result.forEach( (w, i) => {
      t1.push(w[0]);
      if (s1.result.length-1 > i) {
        t1.push(w[0]+s1.result[i+1][0]);
      }
    })
    return t1;
  }
  const t1 = getword(s1);
  const t2 = getword(s2);

  const total = s1.result.length + s1.result.length - 1 + s1.important.length;

  let point = 0;
  t2.forEach( w => {
    if (t1.some( v => {
      return (w === v)
    })) {
      point ++;
    }
  })

  s1.important.forEach( v => {
    if (s2.sentence.indexOf(v) >= 0) {
      point ++;
    }
  })

  return point/total;
}

const prepare = (sentense, callback) => {
  const t2 = generate(sentense).map( v => {
    return parse(v);
  })
  const data = [];
  const mecabParse = (callback) => {
    if (t2.length <= 0) {
      callback(null, data);
      return;
    }
    const sentence = t2.shift();
    mecab.parse(sentence[0], (err, result) => {
      if (err) {
        callback(err, data)
        return;
      }
      data.push({
        sentence: sentence[0],
        result,
        important: sentence.slice(1),
      });
      mecabParse(callback);
    });
  }
  mecabParse((err, data) => {
    callback(err, data);
  })
}

const functions = {
  //組み合わせ文字列を生成
  generate: function(sentense) {
    return generate(sentense);
  },
  //重要文字を抜き出し
  preprocess: function(sentense) {
    return generate(sentense).map( v => {
      return parse(v);
    })
  },
  //形態素解析
  parse: function(sentense, callback) {
    mecab.parse(sentense, callback);
  },
  //組み合わせ文字から形態素解析まで
  prepare,
  //比較
  compare: function(sentense, target, callback) {
    const cmp = (sentenses, target, callback) => {
      mecab.parse(target, (err, result) => {
        let point = 0;
        let length = 0;
        sentenses.forEach( s => {
          const t = { sentence: target, result, };
          const p = compare(s, t);
          if (point < p) {
            point = p;
            length = target.length;
          }
        });
        callback(null, {
          point,
          length,
          sentenses,
        });
      })
    }
    if (typeof target === 'string') {
      prepare(sentense, (err, data) => {
        cmp(data, target, callback);
      })
    } else {
      cmp(sentense, target, callback);
    }
  },
}

module.exports = functions;

if (require.main === module) {
  const src = process.argv[2] || "明日の天気[を教えて|が知りたい]";
  const dst = process.argv[3] || '明日の天気教え';
  functions.compare(src, dst, (err, result) => {
    if (err) console.log(err);
    console.log(`src:${src} dst:${dst} point:${result.point} length:${result.length}`);
  })

  console.log(functions.preprocess(src));

  functions.parse('カスピ海ってどこにあるの', (err, result) => {
    console.log(result);
  })
}
