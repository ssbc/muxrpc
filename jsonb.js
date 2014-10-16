var pull = require('pull-stream')
var JSONB = require('json-buffer')
var muxrpc = require('./index')

module.exports = function (remoteApi, localApi) {
  var spawner = muxrpc(remoteApi, localApi)

  // wrap the spawner
  return function(local) {
    // create as usual
    var inst = spawner(local)

    // then patch the createStream func
    var origCreateStream = inst.createStream
    inst.createStream = function() {
      var s = origCreateStream.call(this)

      // patch the sink to parse
      var origsink = s.sink
      s.sink = function(read) {
        return origsink.call(s, function(end, cb) {
          read(end, function(ended, data) {
            if (data !== void 0)
              data = JSONB.parse(data)
            cb(ended, data)
          })
        })
      }

      // patch the source to serialize
      var origsource = s.source
      s.source = function(abort, cb) {
        return origsource.call(s, abort, function(ended, data) {
          if (data !== void 0)
            data = JSONB.stringify(data)
          cb(ended, data)
        })
      }

      return s
    }
    return inst
  }
}