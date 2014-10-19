var pull = require('pull-stream')
// wrap pull streams around packet-stream's weird streams.

module.exports = function (weird, done) {
  var buffer = [], ended = false, waiting

  done = done || function () {}

  weird.read = function (data, end) {
    ended = ended || end

    if(waiting) {
      var cb = waiting
      waiting = null
      cb(ended, data)
    }
    else if(!ended) buffer.push(data)

    if(ended) done(ended !== true ? ended : null)

  }

  return {
    source: function (abort, cb) {
      if(abort) {
        weird.write(null, abort)
        cb(abort); done(abort)
      }
      else if(buffer.length) cb(null, buffer.shift())
      else if(ended) cb(ended)
      else waiting = cb
    },
    sink  : function (read) {
      pull.drain(function (data) {
        weird.write(data)
      }, function (err) {
        weird.write(null, ended = err || true)
        done(ended !== true ? ended : null)
      }) (read)
    }
  }
}

module.exports.source = function (s) {
  return module.exports(s).source
}
module.exports.sink = function (s) {
  return module.exports(s).sink
}

