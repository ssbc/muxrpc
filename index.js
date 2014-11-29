var pull         = require('pull-stream')
var pullWeird    = require('./pull-weird')
var PacketStream = require('packet-stream')
var EventEmitter = require('events').EventEmitter
var Permissions  = require('./permissions')
var goodbye      = require('pull-goodbye')

function isFunction (f) {
  return 'function' === typeof f
}

function isString (s) {
  return 'string' === typeof s
}

function isObject (o) {
  return o && 'object' === typeof o
}

function getPath(obj, path) {
  if(isString(path)) return obj[path]
  for(var i = 0; i < path.length; i++) {
    obj = obj[path[i]]
    if(null == obj) return obj
  }
  return obj
}

module.exports = function (remoteApi, localApi, serializer) {
  localApi = localApi || {}
  remoteApi = remoteApi || {}

  var perms = Permissions()

  return function (local) {
    local = local || {}

    var emitter = new EventEmitter ()

    function has(type, name) {
      return type === getPath(localApi, name) && isFunction(get(name))
    }

    function get(name) {
      return getPath(local, name)
    }

    function createPacketStream () {

      return PacketStream({
        message: function (msg) {
          if(isString(msg)) return
          if(msg.length > 0 && isString(msg[0]))
            emitter._emit.apply(emitter, msg)
        },
        request: function (opts, cb) {
          var name = opts.name
          var err = perms.test(name)
          if(err) return cb(err)
          if(!has('async', name))
            return cb(new Error('method not supported:'+name))
          var args = opts.args
          var inCB = false
          args.push(function (err, value) {
            inCB = true
            cb(err, value)
          })
          //packet stream already has a thing to check cb fires only once.
          try { get(name).apply(emitter, args) }
          catch (err) {
            if(inCB) throw err
            cb(err)
          }
        },
        stream: function (stream) {
          stream.read = function (data, end) {
            var name = data.name
            var type = data.type

            stream.read = null

            var err = perms.test(name)
            if(err) return stream.write(null, err)

            if(end) return stream.write(null, end)

            if (!has(type, name))
                return stream.destroy(new Error('no '+type+':'+name))

            if(type === 'source') {
              var source, sink = pullWeird.sink(stream)
              try {
                source = get(name).apply(emitter, data.args)
              } catch (err) {
                return sink(pull.error(err))
              }
              sink(source)
            }
            else if (type == 'sink') {
              var sink, source = pullWeird.source(stream)
              try {
                sink = get(name).apply(emitter, data.args)
              } catch (err) {
                return pullWeird.sink(stream)(pull.error(err))
              }
              sink(source)
            }
            else if (type == 'duplex') {
              var s1 = pullWeird(stream)
              try {
                s2 = get(name).apply(emitter, data.args)
              } catch (err) {
                return s1.sink(pull.error(err))
              }
              pull(s1, s2, s1)
            }
            else {
              return stream.write(null, new Error('unsupported stream type:'+type))
            }
          }
        }
      })
    }

    var ps = createPacketStream(), _cb
    //if we create the stream immediately,
    //we get the pull-stream's internal buffer
    //so all operations are queued for free!
    var ws = goodbye(pullWeird(ps, function (err) {
      if(_cb) _cb(err)
    }))

    var noop = function(err) {
      if (err) throw err
    }

    function createMethod(name, type) {
      return (
        'async' === type ?
          function () {
            var args = [].slice.call(arguments)
            if(isFunction (args[args.length - 1]))
              cb = args.pop()
            else
              cb = noop

            ps.request({name: name, args: args}, cb)
          }
        : 'source' === type ?
          function () {
            var args = [].slice.call(arguments)
            var ws = ps.stream()
            var s = pullWeird.source(ws)
            ws.write({name: name, args: args, type: 'source'})
            return s
          }
        : 'sink' === type ?
          function () {
            var args = [].slice.call(arguments)
            var ws = ps.stream()
            var s = pullWeird.sink(ws)
            ws.write({name: name, args: args, type: 'sink'})
            return s
          }
        : 'duplex' === type ?
          function () {
            var args = [].slice.call(arguments)
            var ws = ps.stream()
            var s = pullWeird(ws)
            ws.write({name: name, args: args, type: 'duplex'})
            return s
          }
        : (function () {
            throw new Error('unsupported type:' + JSON.stringify(type))
          })()
      )
    }

    function addApi(obj, api, path) {
      for(var name in api) {
        var type = api[name]
        var _path = path ? path.concat(name) : [name]
        obj[name] =
            isObject(type)
          ? addApi({}, type, _path)
          : createMethod(_path, type)
      }
      return obj
    }

    addApi(emitter, remoteApi)

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
        ws = goodbye(pullWeird(ps, cb))
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

    emitter.close = function (cb) {
      ps.close(cb)
      return emitter
    }

    return emitter
  }
}
