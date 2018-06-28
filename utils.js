const fs = require('fs');
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

function trimSpace(name) {
  return name.replace(/\s/,'');
}

function AttendanceList(robot_data, dates_list, student_list) {
  const attendlist = {};
  dates_list.forEach( day => {
    const r = {};
    Object.keys(robot_data.quizAnswers).forEach( q => {
      Object.keys(robot_data.quizAnswers[q]).forEach( qt => {
        Object.keys(robot_data.quizAnswers[q][qt]).forEach( clientId => {
          const d = new Date(robot_data.quizAnswers[q][qt][clientId].time);
          if (d.toDateString() === day.src.toDateString()) {
            r[trimSpace(robot_data.quizAnswers[q][qt][clientId].name)] = true;
          }
        });
      });
    });
    //リストにない名前を外す
    {
      const res = {}
      Object.keys(r).filter( v => {
        return student_list.some( t => {
          return ((t.indx && t.indx >= 0) && (trimSpace(t.name) == v));
        })
      }).forEach( name => {
        res[name] = true;
      });
      attendlist[day.src.toDateString()] = res;
    }
  });
  return attendlist;
}

function AttendanceCSV(robot_data, dates_list, student_list) {
  const list = AttendanceList(robot_data, dates_list, student_list);
  let r = '';
  r += '生徒番号,名前,'+dates_list.map( v => {
    const d = new Date(v.dst)
    return `${('  '+(d.getMonth()+1)).slice(-2)}月${('  '+d.getDate()).slice(-2)}日`
  }).join(',');
  student_list.filter(t => {
    return (t.indx && t.indx >= 0);
  }).forEach( t => {
    r += '\n';
    r += `${t.indx},${t.name}`;
    const name = t.name;
    dates_list.forEach( day => {
      r += ',';
      try {
        if (list[day.src.toDateString()][trimSpace(name)]) {
          r += '出席';
        }
      } catch(err) {
        console.log(err);
      }
    });
  })
  return r;
}

function AttendanceLoad(robotdata_path, studentlist_path, datelist_path) {
  const quiz = (robotdata_path) ? require(robotdata_path) : [];

  var students = (studentlist_path) ? (function() {
    try {
      var d = fs.readFileSync(studentlist_path);
      return d.toString().split('\n').map( v => {
        if (v.indexOf('#') === 0) {
          return null;
        }
        if (v == '-') {
          return {
            name: '-',
            kana: '',
          }
        }
        var t = v.match(/(.+)\((.+)\)\/(.*)/);
        if (!t) {
          t = v.match(/(.+)\((.+)\)/);
          if (!t) {
            return null;
          }
        }
        return {
          name: t[1].trim(),
          kana: t[2].trim(),
          indx: (t[3])?t[3].trim():-1,
        }
      }).filter( l => {
        return (l);
      });
    } catch(err) {
    }
    return [];
  })() : [];

  var dates = (datelist_path) ? (function() {
    try {
      var d = fs.readFileSync(datelist_path);
      return d.toString().split('\n').map( v => {
        const d = v.match(/(.*)\/(.*)\/(.*)\((.*)\/(.*)\/(.*)\)/);
        if (!d) {
          const t = new Date(v);
          return { src: t, dst: t};
        }
        const dst = new Date(`${d[1]}/${d[2]}/${d[3]}`);
        const src = new Date(`${d[4]}/${d[5]}/${d[6]}`);
        return { src, dst }
      }).filter(v => {
        return v.src.toString() !== 'Invalid Date';
      });
    } catch(err) {
    }
    return [];
  })() : [];

  return { quiz, dates, students }
}

module.exports = {
  attendance: {
    load: AttendanceLoad,
    list: AttendanceList,
    csv:  AttendanceCSV,
  },
  kill,
}

if (require.main === module) {
  const { quiz, dates, students } = AttendanceLoad('./robot-data.json', './quiz-student.txt', './date-list.txt');
  const attendList = AttendanceList(quiz, dates,  students);
  const csv = AttendanceCSV(quiz, dates,  students);
  console.log(csv);
}
