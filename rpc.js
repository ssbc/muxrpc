'use strict';
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

module.exports = function (codec) {

  var localApi = {}, local = {}, remoteApi = {}
  var emitter = null, id = null
  var context = {
        _emit: function (event, value) {
          emitter && emitter._emit(event, value)
          return context
        }
      }

  function has(type, name) {
    return type === u.get(localApi, name)
  }

  function localCall(type, name, args) {

    //this one needs execute on emitter, so
    //because otherwise it wont find the listeners.
    if(name === 'emit')
      throw new Error('emit has been removed')
//      return emitter._emit.apply(emitter, args)

    if(type === 'async')
      if(has('sync', name)) {
        var cb = args.pop(), value
        try { value = u.get(local, name).apply(context, args) }
        catch (err) { return cb(err) }
        return cb(null, value)
      }

    if (!has(type, name))
      throw new Error('no '+type+':'+name)

    return u.get(local, name).apply(context, args)
  }

  function createStream (path, perms, onClose) {

    perms = Permissions(perms)

    function _localCall (type, name, args) {
      var err = perms.pre(name)
      if(err) throw err
      return localCall(type, name, args)
    }

    var ws = initStream(_localCall, codec, onClose)
    ws.createAccess = function () {
      return createAccess(path, perms, ws)
    }

    return ws
  }

  return {
    mountLocal: function (path, _api, _l) {
      u.mount(localApi, path, _api)
      u.mount(local, path, _l)
      return this
    },
    //add a remote interface... at path.
    //but also, should provide a function that is called
    //when accessing down `path`, this could send a message
    //along another stream... to do the remote call...
    mountRemote: function (path, _api) {
      u.mount(remoteApi, path, _api)
      return this
    },
    createStream: createStream,
    access: function (path, perms) {
      return createAccess(path, perms)
    }
  }

  function createAccess(path, perms, _ws) {
    var _cb

    function onClose (err) {
      if(emitter.closed) return
      emitter.closed = true
      emitter._emit('closed')
      if(_cb) {
        var cb = _cb; _cb = null; cb(err)
      }
    }

    var ws = _ws || createStream(path, perms, onClose)

    //if we create the stream immediately,
    //we get the pull-stream's internal buffer
    //so all operations are queued for free!

    emitter = createApi([], remoteApi, function (type, name, args, cb) {
      if(ws.closed) throw new Error('stream is closed')
      return ws.remoteCall(type, name, args, cb)
    })

    //g/setter for id. this is enough to support the way scuttlebot
    //works with access to the rpc object.

    Object.__defineGetter__.call(emitter, 'id', function () {
      return id
    })

    Object.__defineSetter__.call(emitter, 'id', function (value) {
      context.id = id = value
    })

    var first = true

    emitter.createStream = function (cb) {
      _cb = cb
      if(first) { first = false}
      else ws = ws.recreate(onClose)

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

