'use strict'
var pull         = require('pull-stream')
var pullWeird    = require('./pull-weird')
var PacketStream = require('packet-stream')
var EventEmitter = require('events').EventEmitter
var Permissions  = require('./permissions')
var goodbye      = require('pull-goodbye')

var PSC          = require('packet-stream-codec')

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

function isPerms (p) {
  return (
    p &&
    isFunction(p.pre) &&
    isFunction(p.test) &&
    isFunction(p.post)
  )
}

function abortSink (err) {
  return function (read) {
    read(err || true, function () {})
  }
}

function abortDuplex (err) {
  return {source: pull.error(err), sink: abortSink(err)}
}

module.exports = function (remoteApi, localApi, codec) {
  localApi = localApi || {}
  remoteApi = remoteApi || {}

  if(!codec) codec = PSC

  //pass the manifest to the permissions so that it can know
  //what something should be.

  return function (local, perms) {
    local = local || {}

    if(isPerms(perms));
    else if(isObject(perms))
      perms = Permissions(perms)
    else
      perms = Permissions()
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
            var value
            //check that this really is part of the local api.

            stream.read = null

            if(!/^(source|sink|duplex)$/.test(type))
              return stream.write(null, new Error('unsupported stream type:'+type))

            //how would this actually happen?
            if(end) return stream.write(null, end)

            //HANG ON, type should come from the manifest,
            //*not* from what the client sends.
            var err = perms.pre(name, data.args)

            if (!err && !has(type, name))
                err = new Error('no '+type+':'+name)
            else {
              try { value = get(name).apply(emitter, data.args) }
              catch (_err) { err = _err }
            }

            var _stream = pullWeird[
              {source: 'sink', sink: 'source'}[type] || 'duplex'
            ](stream)

            if('source' === type)
              _stream(err ? pull.error(err) : value)
            else if ('sink' === type)
              (err ? abortSink(err) : value)(_stream)
            else if ('duplex' === type)
              pull(_stream, err ? abortDuplex(err) : value, _stream)
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

    function callMethod(name, type, args) {
      var cb = isFunction (args[args.length - 1])
             ? args.pop() : noop
      if(!/^(async|sync|source|sink|duplex)$/.test(type))
        throw new Error('unsupported type:' + JSON.stringify(type))

      if(!ps) {
        var err = new Error('stream is closed')
        if ('async' === type || 'sync' === type) return cb(err)
        else if('source' === type)               return pull.error(err)
        else if('sink' === type)                 return abortSink(err)
        else if('duplex' === type) {
          cb(err)
          return { source: pull.error(err), sink: abortSink(err) }
        }
      }

      if('async' === type || 'sync' === type)
          return ps.request({name: name, args: args}, cb)

      var ws = ps.stream(), s = pullWeird[type](ws, cb)
      ws.write({name: name, args: args, type: type})
      return s
    }

    //add all the api methods to emitter recursively
    ;(function recurse (obj, api, path) {
      for(var name in api) (function (name, type) {
        var _path = path ? path.concat(name) : [name]
        obj[name] =
            isObject(type)
          ? recurse({}, type, _path)
          : function () {
              return callMethod(_path, type, [].slice.call(arguments))
            }
      })(name, api[name])
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
      var stream = codec ? codec(ws) : ws
      stream.close = ps.close.bind(ps)
      return stream
    }

    emitter.closed = false
    emitter.close = function (err, cb) {
      if(isFunction(err))
        cb = err, err = false
      if(!ps) return (cb && cb())
      if(err) return ps.destroy(err), (cb && cb())

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
