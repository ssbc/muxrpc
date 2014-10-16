var pull = require('pull-stream')
// wrap pull streams around packet-stream's weird streams.

function source (weird) {
}

function sink (weird) {
  return 
}

module.exports = function (weird) {
  var buffer = [], ended = false, waiting
  weird.read = function (data, end) {
    console.log('ENDED?', end)
    ended = ended || end
    if(waiting) {
      var cb = waiting
      waiting = null
      cb(ended, data)
    }
    else
      if(!ended) buffer.push(data)
  }

  return {
    source: function (abort, cb) {
      if(abort) return weird.write(null, abort), cb(abort)
      if(buffer.length) cb(null, buffer.shift())
      else if(ended) cb(ended)
      else waiting = cb
    },
    sink  : function (read) {
      pull.drain(function (data) {
        weird.write(data)
      }, function (end) {
        weird.write(null, end || true)
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

