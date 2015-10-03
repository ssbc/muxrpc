var u            = require('./util')
var EventEmitter = require('events').EventEmitter
var Permissions  = require('./permissions')

var goodbye      = require('pull-goodbye')
var pull         = require('pull-stream')
var pullWeird    = require('./pull-weird')
var initStream   = require('./stream')
var createApi    = require('./api')
function isFunction (f) {
  return 'function' === typeof f
}

function isObject (o) {
  return o && 'object' === typeof o
}

function isPerms (p) {
  return (
    p &&
    isFunction(p.pre) &&
    isFunction(p.test) &&
    isFunction(p.post)
  )
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

    var emitter

    function has(type, name) {
      return type === u.get(localApi, name) && isFunction(get(name))
    }

    function get(name) {
      return u.get(local, name)
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

    emitter = createApi([], remoteApi, function (name, type, args, cb) {

      if(ws.closed) err = new Error('stream is closed')
      else          err = perms.pre(name, args)
      if(err) throw err

      return ws.remoteCall(name, type, args, cb)
    })

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
