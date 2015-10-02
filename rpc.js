var u            = require('./util')
var EventEmitter = require('events').EventEmitter
var Permissions  = require('./permissions')

var goodbye      = require('pull-goodbye')
var pull         = require('pull-stream')
var pullWeird    = require('./pull-weird')
var initStream   = require('./stream')

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

function noop (err) {
  if (err) throw err
}


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

    var ws, _cb, once = false


    function localCall(name, args, type) {
      var err = perms.pre(name)
      if(err) throw err

      if(name === 'emit')
        return emitter._emit.apply(emitter, args)

      if(type === 'async')
        if(has('sync', name)) {
          var cb = args.pop(), value
          try { value = get(name).apply(emitter, args) }
          catch (err) { return cb(err) }
          return cb(null, value)
        }

      if (!has(type, name))
        throw new Error('no '+type+':'+name)
      return get(name).apply(emitter, args)
    }

    //if we create the stream immediately,
    //we get the pull-stream's internal buffer
    //so all operations are queued for free!
    ws = initStream(localCall, codec)

    function remoteCall (name, type, args) {
      var cb = isFunction (args[args.length - 1]) ? args.pop() : noop
      var err, value
      if(ws.closed)
        err = new Error('stream is closed')
      else
        try {
          value = ws.remoteCall(name, type, args, cb)
        } catch(_err) {
          err = _err
        }

      return err ? u.errorAsStreamOrCb(type, err, cb) : value
    }

    //add all the api methods to emitter recursively
    ;(function recurse (obj, api, path) {
      for(var name in api) (function (name, type) {
        var _path = path ? path.concat(name) : [name]
        obj[name] =
            isObject(type)
          ? recurse({}, type, _path)
          : function () {
              return remoteCall(_path, type, [].slice.call(arguments))
            }
      })(name, api[name])
      return obj
    })(emitter, remoteApi)

    emitter._emit = emitter.emit

    emitter.emit = function () {
      var args = [].slice.call(arguments)
      if(args.length == 0) return

      var err = perms.pre(['emit'], args)
      if(!err) ws.remoteCall('emit', null, args)
      else     throw err

      return emitter
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
      if(!ws.isOpen()) {
        ws = initStream(localCall, codec)
        once = false
      }
      else if(once)
        throw new Error('only one stream allowed at a time')

      ws.onClose = function (err) {
        if(emitter.closed) return
        emitter.closed = true
        emitter._emit('closed')
        if(_cb) {
          var cb = _cb; _cb = null; cb(err)
        }
      }

      once = true
      emitter.close = ws.close
      ws.closed = false
      return ws
    }

    emitter.closed = false

    emitter.close = function (err, cb) {
      ws.close(err, cb)
      return this
    }

    return emitter
  }
}
