var u            = require('./util')
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
  return u.get(obj, path)
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

function isSource    (t) { return 'source' === t }
function isSink      (t) { return 'sink'   === t }
function isDuplex    (t) { return 'duplex' === t }
function isSync      (t) { return 'sync'  === t }
function isAsync     (t) { return 'async'  === t }
function isRequest   (t) { return isSync(t) || isAsync(t) }
function isStream    (t) { return isSource(t) || isSink(t) || isDuplex(t) }

module.exports = function (codec) {

  var localApi = {}, local = {}, remoteApi = {}

  return {
    mountLocal: function (path, _api, _l) {
      u.mount(localApi, path, _api)
      u.mount(local, path, _l)
      return this
    },
    mountRemote: function (path, _api) {
      u.mount(remoteApi, path, _api)
      return this
    },
    access: function (path, perms) {
      return createAccess(path, perms)
    }
  }

  function createAccess(path, perms) {

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

      function localCall(name, args) {

        //emitter is called in this context,
        //so that the callee has a handle on who is calling.
        //this is used in secret-stack/sbot... Although,
        //I suspect just to track the id of the caller?
        //do they ever make requests back from that api?
        //(I have a feeling they don't...
        // so it may be possible to change this)

        return get(name).apply(emitter, args)
      }

      return PacketStream({
        message: function (msg) {
          if(isString(msg)) return
          if(msg.length > 0 && isString(msg[0]))
            emitter._emit.apply(emitter, msg)
        },
        request: function (opts, cb) {
          var name = opts.name, args = opts.args
          var inCB = false, async = false, value

          var err = perms.pre(name)
          if(err) return cb(err)

          if(async = has('async', name))
            args.push(function (err, value) {
              inCB = true; cb(err, value)
            })
          else if(!has('sync', name))
            return cb(new Error('method not supported:'+name))

          try {
            value = localCall(name, args)
          } catch (err) {
            if(inCB) throw err
            return cb(err)
          }

          if(!async) cb(null, value)
        },
        stream: function (stream) {
          stream.read = function (data, end) {
            var name = data.name
            var type = data.type
            var value
            //check that this really is part of the local api.

            stream.read = null

            if(!isStream(type))
              return stream.write(null, new Error('unsupported stream type:'+type))

            //how would this actually happen?
            if(end) return stream.write(null, end)

            //HANG ON, type should come from the manifest,
            //*not* from what the client sends.
            var err = perms.pre(name, data.args)

            if (!err && !has(type, name))
                err = new Error('no '+type+':'+name)
            else {
              try { value = localCall(name, data.args) }
              catch (_err) { err = _err }
            }

            var _stream = pullWeird[
              {source: 'sink', sink: 'source'}[type] || 'duplex'
            ](stream)

            if(isSource(type))
              _stream(err ? pull.error(err) : value)
            else if (isSink(type))
              (err ? abortSink(err) : value)(_stream)
            else if (isDuplex(type))
              pull(_stream, err ? abortDuplex(err) : value, _stream)
          }
        },

        close: closed
      })
    }

    var ps, ws, _cb, once = false

    function initStream () {

      ps = createPacketStream()//, _cb
      ws = goodbye(pullWeird(ps, function (err) {
        if(_cb) _cb(err)
      }))

      ws = codec ? codec(ws) : ws
      ws.close = ps.close.bind(ps)

      return ws
    }

    //if we create the stream immediately,
    //we get the pull-stream's internal buffer
    //so all operations are queued for free!
    initStream()


    function noop (err) {
      if (err) throw err
    }

    function last (ary) {
      return ary[ary.length - 1]
    }

    function callMethod(name, type, args) {
      if(!(isRequest(type) || isStream(type)))
        throw new Error('unsupported type:' + JSON.stringify(type))

      var cb = isFunction (args[args.length - 1]) ? args.pop() : noop

      if(!ps) {
        var err = new Error('stream is closed')
        return (
            isRequest(type) ? cb(err)
          : isSource(type)  ? pull.error(err)
          : isSink(type)    ? abortSink(err)
          :                   cb(err), abortDuplex(err)
        )
      }

      if(isRequest(type))
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

    //this is the stream to the remote server.
    //it only makes sense to have one of these.
    //either throw an error if the user creates
    //another when the previous has not yet ended
    //or abort the previous one, and create a new one?

    //there is very little test coverage for this,
    //and I don't think we have ever used this feature.
    //should remove if this does not break anything.

    var once = false

    emitter.createStream = function (cb) {
      _cb = cb
      if(!ps || ps.ended) {
        initStream()
        once = false
      }
      else if(once)
        throw new Error('only one stream allowed at a time')

      once = true

      return ws
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
      return this
    }

    return emitter
  }
}
