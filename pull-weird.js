'use strict'
const pull = require('pull-stream')
// wrap pull streams around packet-stream's weird streams.

function once (fn) {
  let done = false
  return (err, val) => {
    if (done) return
    done = true
    fn(err, val)
  }
}

function duplex (weird, _done) {
  const buffer = []
  let ended = false
  let aborted = false
  let waiting
  let abort

  const done = once((err, v) => {
    if (_done) _done(err, v)
    // deallocate
    weird = null
    _done = null
    waiting = null
    if (abort) abort(err || true, () => {})
  })

  weird.read = function (data, end) {
    ended = ended || end

    if (waiting) {
      const cb = waiting
      waiting = null
      cb(ended, data)
    } else if (!ended && !aborted) {
      buffer.push(data)
    }

    if (ended) {
      done(ended !== true ? ended : null)
    }
  }

  return {
    source (abort, cb) {
      if (abort) {
        if (weird) weird.write(null, abort)
        cb(abort)
        buffer.length = 0
        aborted = true
        done(abort !== true ? abort : null)
      } else if (buffer.length) {
        cb(null, buffer.shift())
      } else if (ended) {
        cb(ended)
      } else {
        waiting = cb
      }
    },
    sink (read) {
      if (ended) {
        abort = null
        return read(ended, () => {})
      }
      abort = read
      pull.drain((data) => {
        // TODO: make this should only happen on a UNIPLEX stream.
        if (ended) return false
        weird.write(data)
      }, (err) => {
        if (weird && !weird.writeEnd) {
          weird.write(null, err || true)
        }
        if (done) done(err)
      })(read)
    }
  }
}

function uniplex (s, done) {
  return duplex(s, (err) => {
    if (!s.writeEnd) s.write(null, err || true)
    if (done) done(err)
  })
}

function source (s) {
  return uniplex(s).source
}

function sink (s, done) {
  return uniplex(s, done).sink
}

module.exports = duplex
module.exports.source = source
module.exports.sink = sink
module.exports.duplex = duplex
