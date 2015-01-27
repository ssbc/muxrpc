var pull = require('pull-stream')
// wrap pull streams around packet-stream's weird streams.

function once (fn) {
  var done = false
  return function (err, val) {
    if(done) return
    done = true
    fn(err, val)
  }
}

module.exports = function (weird, _done) {
  var buffer = [], ended = false, waiting

  var done = once(function (err, v) {
    _done && _done(err, v)

    // deallocate
    weird = null
    _done = null    
    waiting = null
  })

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
        weird && weird.write(null, abort)
        cb(abort); done(abort !== true ? abort : null)
      }
      else if(buffer.length) cb(null, buffer.shift())
      else if(ended) cb(ended)
      else waiting = cb
    },
    sink  : function (read) {
      pull.drain(function (data) {
        //TODO: make this should only happen on a UNIPLEX stream.
        if(ended) return false
        weird.write(data)
      }, function (err) {
        if(weird && !weird.writeEnd) weird.write(null, err || true)
        done && done(err)
      })
      (read)
    }
  }
}

function uniplex (s, done) {
  return module.exports(s, function (err) {
    if(!s.writeEnd) s.write(null, err || true)
    if(done) done(err)
  })
}

module.exports.source = function (s, done) {
  return uniplex(s, done).source
}
module.exports.sink = function (s, done) {
  return uniplex(s, done).sink
}

