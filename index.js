var pull = require('pull-stream')
var pullWeird = require('./pull-weird')
var PacketStream = require('packet-stream')
var EventEmitter = require('events').EventEmitter
var Permissions = require('./permissions')
function isFunction (f) {
  return 'function' === typeof f
}

function isString (s) {
  return 'string' === typeof s
}

module.exports = function (remoteApi, localApi, serializer) {
  localApi = localApi || {}
  remoteApi = remoteApi || {}

  var perms = Permissions()

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

    function hasSink(name) {
      return (
        localApi.sink
        && ~localApi.sink.indexOf(name)
        && isFunction(local[name])
      )
    }

    function hasDuplex(name) {
      return (
        localApi.duplex
        && ~localApi.duplex.indexOf(name)
        && isFunction(local[name])
      )
    }

    function createPacketStream () {

      return PacketStream({
        message: function (msg) {
          if(msg.length > 0 && isString(msg[0]))
            emitter._emit.apply(emitter, msg)
        },
        request: function (opts, cb) {
          var name = opts.name
          var err = perms.test(name)
          if(err) return cb(err)

          if(!hasAsync(name))
            return cb(new Error('method not supported:'+name))
          var args = opts.args
          var inCB = false
          args.push(function (err, value) {
            inCB = true
            cb(err, value)
          })
          //packet stream already has a thing to check cb fires only once.
          try { local[name].apply(emitter, args) }
          catch (err) {
            if(inCB) throw err
            cb(err)
          }
        },
        stream: function (stream) {
          stream.read = function (data, end) {
            var name = data.name
            stream.read = null

            var err = perms.test(name)
            if(err) return stream.write(null, err)

            if(end) return stream.write(null, end)

            if (data.type == 'source') {
              if(!hasSource(name))
                return stream.destroy(new Error('no source:'+name))

              var source, sink = pullWeird.sink(stream)
              try {
                source = local[name].apply(emitter, data.args)
              } catch (err) {
                return sink(pull.error(err))
              }
              sink(source)
            }
            else if (data.type == 'sink') {
              if(!hasSink(name))
                return stream.destroy(new Error('no sink:'+name))

              var sink, source = pullWeird.source(stream)
              try {
                sink = local[name].apply(emitter, data.args)
              } catch (err) {
                return pullWeird.sink(stream)(pull.error(err))
              }
              sink(source)
            }
            else if (data.type == 'duplex') {
              if(!hasDuplex(name))
                return stream.destroy(new Error('no duplex:'+name))

              var s1 = pullWeird(stream)
              try {
                s2 = local[name].apply(emitter, data.args)
              } catch (err) {
                return s1.sink(pull.error(err))
              }
              pull(s1, s2, s1)
            }
            else {
              return stream.write(null, new Error('unsupported stream type:'+data.type))
            }
          }
        }
      })
    }

    var ps = createPacketStream(), _cb
    //if we create the stream immediately,
    //we get the pull-stream's internal buffer
    //so all operations are queued for free!
    var ws = pullWeird(ps, function (err) {
      if(_cb) _cb(err)
    })

    var noop = function(err) {
      if (err) throw err
    }
    if(remoteApi.async)
      remoteApi.async.forEach(function (name) {
        emitter[name] = function () {
          var args = [].slice.call(arguments)
          if(isFunction (args[args.length - 1]))
            cb = args.pop()
          else
            cb = noop

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

    if(remoteApi.sink)
      remoteApi.sink.forEach(function (name) {
        emitter[name] = function () {
          var args = [].slice.call(arguments)
          var ws = ps.stream()
          var s = pullWeird.sink(ws)
          ws.write({name: name, args: args, type: 'sink'})
          return s
        }
      })

    if(remoteApi.duplex)
      remoteApi.duplex.forEach(function (name) {
        emitter[name] = function () {
          var args = [].slice.call(arguments)
          var ws = ps.stream()
          var s = pullWeird(ws)
          ws.write({name: name, args: args, type: 'duplex'})
          return s
        }
      })


    emitter._emit = emitter.emit

    emitter.emit = function () {
      var args = [].slice.call(arguments)
      if(args.length == 0) return
      ps.message(args)
      return emitter
    }

    //this is the stream to the remote server.
    //it only makes sense to have one of these.
    //either throw an error if the user creates
    //another when the previous has not yet ended
    //or abort the previous one, and create a new one?

    var once = false

    emitter.createStream = function (cb) {
      if(ps.ended) {
        ps = createPacketStream()
        ws = pullWeird(ps, cb)
        once = false
      }
      else if(once)
        throw new Error('only one stream allowed at a time')
      else
      //set the cb, this applies to the first stream created only.
        _cb = cb
      once = true
      var stream = (serializer) ? serializer(ws) : ws
      stream.close = ps.close
      return stream
    }

    emitter.permissions = perms

    return emitter
  }
}
