import * as EventEmitter from "events"

function Speech() {
  var t = new EventEmitter()
  return t
}

const sp = Speech()
module.exports = sp
