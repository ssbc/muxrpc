
var toPull = require('push-stream-to-pull-stream')
var pull = require('pull-stream')

exports.duplex = function (stream, cb) {
  return {
    source: toPull.source(stream),
    sink: toPull.sink(stream, cb)
  }
}
exports.sink = function (stream, cb) {
  var sink = toPull.sink(stream)
  var ended = false
  stream.pipe({
    paused: false,
    write: function (data) {
      ended = true
      cb && cb(null, data)
    },
    end: function (err) {
      if(ended) return
      cb && cb((ended = err) === true ? null : err)
    }
  })
  return sink
}

exports.source = function (stream, cb) {
  //HACK: this is basically an ugly hack to be compatbile
  //with muxrpc@6, but we can do better: instead
  //check if the remote sink stream takes a callback
  return pull(
    toPull.source(stream),
    function (read) {
      return function (abort, cb) {
        read(abort, function (end, data) {
          if(end) stream.end(end)
          cb(end, data)
        })
      }
    }
  )
}

