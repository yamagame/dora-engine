const fs = require('fs');
const path = require('path');
const { loadSheet } = require('./googleSheet');
const mecab = require('./mecab');

const mecabAsync = (str) => {
  return new Promise( resolved => {
    mecab.parse(str, (err, result) => {
      resolved(result);
    })
  })
}

const matchAll = (str, regex) => {
  const ret = [];
  const match = (str) => {
    const t = regex.exec(str);
    if (t) {
      ret.push(t[1]);
      match(str.slice(t.index+t[0].length));
    }
  }
  match(str);
console.log(ret);
  return ret;
}

module.exports = function(config) {
  this.sheets = {};
  this.load = (sheetId, sheetName, { download='auto', useMecab=true }) => {
    return new Promise( (resolved, rejected) => {
      const cachePath = () => path.join(config.cacheDir, `${sheetName}.json`);
      const loadSheetFromGoogleSheet = () => {
        if (download === 'auto' || download === 'none') {
          if (sheetName in this.sheets) {
            return resolved(this.sheets[sheetName]);
          }
          if (download !== 'auto') {
            return resolved([]);
          }
        }
        if (!(config.credentialPath && config.tokenPath) || (!sheetId)) return resolved([]);
        loadSheet({
          ...config,
          sheetId,
          sheetName,
        }, async (err, data, head) => {
          if (err) return rejected(err);
          const r = [];
          let t = {}
          const askKey = (head.indexOf('ask') >= 0);
          for (var i in data) {
            const v = data[i];
            if (askKey) {
              if (!v.ask) {
                if (t) {
                  let w = (v.weight)?parseInt(v.weight):1;
                  for (var i=0;i<w;i++) {
                    t.answer.push(v.answer);
                  }
                }
              } else {
                if (!Array.isArray(v.answer)) {
                  let w = (v.weight)?parseInt(v.weight):1;
                  const answer = v.answer;
                  v.answer = [];
                  for (var i=0;i<w;i++) {
                    v.answer.push(answer);
                  }
                }
                const keyword = matchAll(v.ask, /\((.+?)\)/);
                v.keyword = keyword;
                if (useMecab) {
                  const result = await mecabAsync(v.ask);
                  v.ask = {
                    org: v.ask,
                    morpho: result.map( v => v[0] ).join(' '),
                  }
                } else {
                  v.ask = {
                    org: v.ask,
                    morpho: v.ask,
                  }
                }
                t = v;
                r.push(v);
              }
            } else {
              r.push(v);
            }
          }
          this.sheets[sheetName] = r;
          if (config.cacheDir) {
            fs.writeFile(cachePath(), JSON.stringify(r, null, '  '), (err) => {
              resolved(r);
            })
          } else {
            resolved(r);
          }
        })
      }
      if (config.cacheDir) {
        fs.readFile(cachePath(), (err, data) => {
          if (!err) {
            try {
              this.sheets[sheetName] = JSON.parse(data);
            } catch(err) {
            }
          }
          loadSheetFromGoogleSheet();
        })
      } else {
        loadSheetFromGoogleSheet();
      }
    })
  }
}

if (require.main === module) {
}
