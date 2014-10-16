var pullWeird = require('./pull-weird')
var PacketStream = require('packet-stream')
var EventEmitter = require('events').EventEmitter

function isFunction (f) {
  return 'function' === typeof f
}

function isString (s) {
  return 'string' === typeof s
}

module.exports = function (remoteApi, localApi) {
  localApi = localApi || {}
  remoteApi = remoteApi || {}

  return function (local) {
    local = local || {}

    var emitter = new EventEmitter ()

    function hasAsync(name) {
      return (
        localApi.async
        && ~localApi.async.indexOf(name)
        && isFunction(local[name])
      )
    }

    function hasSource(name) {
      return (
        localApi.source
        && ~localApi.source.indexOf(name)
        && isFunction(local[name])
      )
    }

    function createPacketStream () {

      return PacketStream({
        request: function (opts, cb) {
          var name = opts.name
          if(!hasAsync(name))
            return cb(new Error('method not supported:'+name))
          var args = opts.args
          args.push(cb)
          //packet stream already has a thing to check cb fires only once.
          try { local[name].apply(local, args) }
          catch (err) { cb(isString(err) ? new Error(err) : err) }
        },
        stream: function (stream) {
          stream.read = function (data, end) {
            var name = data.name
            stream.read = null
            if(end) return stream.write(null, end)

            if(!hasSource(name))
              return stream.write(null, new Error('no source:'+name))

            pullWeird.sink(stream) (local[name].apply(local, data.args))
          }
        }
      })
    }

    var ps = createPacketStream()
    //if we create the stream immediately,
    //we get the pull-stream's internal buffer
    //so all operations are queued for free!
    var ws = pullWeird(ps)

    if(remoteApi.async)
      remoteApi.async.forEach(function (name) {
        emitter[name] = function () {
          var args = [].slice.call(arguments)
          var cb = args.pop()
          if(!isFunction (cb))
            throw new Error('callback must be provided')

          ps.request({name: name, args: args}, cb)
        }
      })

    if(remoteApi.source)
      remoteApi.source.forEach(function (name) {
        emitter[name] = function () {
          var args = [].slice.call(arguments)
          var ws = ps.stream()
          var s = pullWeird.source(ws)
          ws.write({name: name, args: args, type: 'source'})
          return s
        }
      })

    //this is the stream to the remote server.
    //it only makes sense to have one of these.
    //either throw an error if the user creates
    //another when the previous has not yet ended
    //or abort the previous one, and create a new one?

    var once = false

    emitter.createStream = function () {
      if(ps.ended) {
        ps = createPacketStream()
        ws = pullWeird(ps)
        once = false
      }
      else if(once)
        throw new Error('only one stream allowed at a time')
      once = true
      return ws
    }

    return emitter
  }
}
