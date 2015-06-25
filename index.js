'use strict'
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

var abortSink = pull.Sink(function (read) { read(true, function () {}) })

module.exports = function (remoteApi, localApi, serializer) {
  localApi = localApi || {}
  remoteApi = remoteApi || {}

  //pass the manifest to the permissions so that it can know
  //what something should be.
  var perms = Permissions(localApi)

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

          var err = perms.pre(name)
          if(err) return cb(err)

          var args = opts.args
          if(has('sync', name)) {
            var value, err
            try {
              value = get(name).apply(emitter, args)
            } catch (_err) {
              err = _err
            }
            return cb(err, value)
          }
          else if(!has('async', name))
            return cb(new Error('method not supported:'+name))
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

            //check that this really is part of the local api.

            stream.read = null

            //HANG ON, type should come from the manifest,
            //*not* from what the client sends.
            var err = perms.pre(name, data.args)

            //how would this actually happen?
            if(end) return stream.write(null, end)

            if (!has(type, name))
                err = new Error('no '+type+':'+name)

            if(type === 'source') {
              var source, sink = pullWeird.sink(stream)
              if(!err)
                try { source = get(name).apply(emitter, data.args) }
                catch (_err) { err = _err }
              sink(err ? pull.error(err) : source)
            }
            else if (type == 'sink') {
              var sink, source = pullWeird.source(stream)
              if(!err)
                try { sink = get(name).apply(emitter, data.args) }
                catch (_err) { err = _err }
                //return pullWeird.sink(stream)(pull.error(err))

              if(err) source(err, function () {})
              else sink(source)
            }
            else if (type == 'duplex') {
              var s1 = pullWeird(stream), s2
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
        },

        close: closed
      })
    }

    function closed (err) {
      // deallocate
      ps = null
      ws = null

      if(emitter && !emitter.closed) {
        emitter.closed = true
        emitter._emit('closed')
        if(_cb) {
          var cb = _cb; _cb = null; cb(err)
        }
        else if(err) emitter.emit('error', err)
      }
    }

    var ps = createPacketStream(), _cb
    //if we create the stream immediately,
    //we get the pull-stream's internal buffer
    //so all operations are queued for free!
    var ws = goodbye(pullWeird(ps, function (err) {
      if(_cb) _cb(err)
    }))

    function noop (err) {
      if (err) throw err
    }

    function last (ary) {
      return ary[ary.length - 1]
    }

    function createMethod(name, type) {
      return (
        'async' === type || 'sync' === type ?
          function () {
            var args = [].slice.call(arguments)
            var cb = isFunction (args[args.length - 1])
                   ? args.pop() : noop

            if (!ps)
              return cb(new Error('stream is closed'))
            ps.request({name: name, args: args}, cb)
          }
        : 'source' === type ?
          function () {
            if (!ps)
              return pull.error(new Error('stream is closed'))

            var args = [].slice.call(arguments)
            var ws = ps.stream()
            var s = pullWeird.source(ws)
            ws.write({name: name, args: args, type: 'source'})
            return s
          }
        : 'sink' === type ?
          function () {
            if (!ps)
              return abortSink()

            var args = [].slice.call(arguments)
            var cb = isFunction (last(args)) ? args.pop() : noop
            var ws = ps.stream()
            var s = pullWeird.sink(ws, cb)
            ws.write({name: name, args: args, type: 'sink'})
            return s
          }
        : 'duplex' === type ?
          function () {
            var args = [].slice.call(arguments)
            var cb = isFunction (last(args)) ? args.pop() : noop

            if (!ps) {
              cb(new Error('stream is closed'))
              return { source: pull.error(new Error('stream is closed')), sink: abortSink() }
            }

            var ws = ps.stream()
            var s = pullWeird(ws, cb)
            ws.write({name: name, args: args, type: 'duplex'})
            return s
          }
        : (function () {
            throw new Error('unsupported type:' + JSON.stringify(type))
          })()
      )
    }

    //add all the api methods to emitter recursively
    ;(function recurse (obj, api, path) {
      for(var name in api) {
        var type = api[name]
        var _path = path ? path.concat(name) : [name]
        obj[name] =
            isObject(type)
          ? recurse({}, type, _path)
          : createMethod(_path, type)
      }
      return obj
    })(emitter, remoteApi)

    emitter._emit = emitter.emit

    emitter.emit = function () {
      if (!ps)
        return
      var args = [].slice.call(arguments)
      if(args.length == 0) return

      var err = perms.pre(['emit'], args)
      if(!err) ps.message(args)
      else     throw err

      return emitter
    }

    //this is the stream to the remote server.
    //it only makes sense to have one of these.
    //either throw an error if the user creates
    //another when the previous has not yet ended
    //or abort the previous one, and create a new one?

    var once = false

    emitter.createStream = function (cb) {
      _cb = cb
      if(!ps || ps.ended) {
        ps = createPacketStream()
        emitter.closed = false
        ws = goodbye(pullWeird(ps, function (err) {
          closed(err)
        }))
        once = false
      }
      else if(once)
        throw new Error('only one stream allowed at a time')

      once = true
      var stream = (serializer) ? serializer(ws) : ws
      stream.close = ps.close.bind(ps)
      return stream
    }

    emitter.permissions = perms

    emitter.closed = false
    emitter.close = function (cb) {
      if (!ps)
        return (cb && cb())
      ps.close(function (err) {
        if(!emitter.closed) {
          emitter.closed = true
          emitter._emit('closed')
        }

        // deallocate
        local = null
        ps = null
        ws = null
        emitter = null

        cb && cb(err)
      })
      return emitter
    }

    return emitter
  }
}
