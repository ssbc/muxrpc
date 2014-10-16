var pull = require('pull-stream')
// wrap pull streams around packet-stream's weird streams.

function source (weird) {
  var buffer = [], ended = false, waiting
  weird.read = function (data, end) {
    if(waiting) {
      var cb = waiting
      waiting = null
      cb(ended = ended || end, data)
    }
    else
      (ended = ended || end) || buffer.push(data)
  }
  return function (abort, cb) {
      if(buffer.length) cb(null, buffer.shift())
      else if(ended) cb(ended)
      else waiting = cb
    }
}

function sink (weird) {
  return function (read) {
      pull.drain(function (data) {
        weird.write(data)
      }, function (end) {
        weird.end(end || true)
      }) (read)
    }
}

module.exports = function (weird) {

  return {
    source: source(weird),
    sink: sink(weird)
  }
}

module.exports.source = source
module.exports.sink = sink
