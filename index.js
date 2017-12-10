'use strict'
var PSC          = require('packet-stream-codec')
var u            = require('./util')
var initStream   = require('./stream')
var createApi    = require('./api')
var createLocalCall = require('./local-api')

function createMuxrpc (remoteApi, localApi, local, id, perms, codec, legacy) {
  var bootstrap
  if (!localApi && !remoteApi) {
    bootstrap = true
  }

  localApi = localApi || {}
  remoteApi = remoteApi || {}
  var emitter
  if(!codec) codec = PSC

  //pass the manifest to the permissions so that it can know
  //what something should be.
  var _cb, ws
  var context = {
      _emit: function (event, value) {
        emitter && emitter._emit(event, value)
        return context
      },
      id: id
    }

  var ws = initStream(
    createLocalCall(local, localApi, perms).bind(context),
    codec, function (err) {
      if(emitter.closed) return
      emitter.closed = true
      emitter.emit('closed')
      if(_cb) {
        var cb = _cb; _cb = null; cb(err)
      }
    }
  )

  emitter = createApi([], remoteApi, function (type, name, args, cb) {
    if(ws.closed) throw new Error('stream is closed')
    return ws.remoteCall(type, name, args, cb)
  }, bootstrap)

  if(legacy) {
    Object.__defineGetter__.call(emitter, 'id', function () {
      return context.id
    })

    Object.__defineSetter__.call(emitter, 'id', function (value) {
      context.id =  value
    })

    var first = true

    emitter.createStream = function (cb) {
      _cb = cb
      if(first) {
        first = false; return ws
      }
      else
        throw new Error('one stream per rpc')
    }
  }
  else
    emitter.stream = ws

  emitter.closed = false

  emitter.close = function (err, cb) {
    ws.close(err, cb)
    return this
  }

  return emitter
}

module.exports = function (remoteApi, localApi, codec) {
  if(arguments.length > 3)
    return createMuxrpc.apply(this, arguments)
  return function (local, perms, id) {
    return createMuxrpc(remoteApi, localApi, local, id, perms, codec, true)
  }
}
