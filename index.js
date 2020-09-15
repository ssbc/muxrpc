'use strict'
var PSC          = require('packet-stream-codec')
var initStream   = require('./stream')
var createRemoteApi    = require('./remote-api')
var createLocalApi = require('./local-api')
var EventEmitter = require('events').EventEmitter

function createMuxrpc (remoteManifest, localManifest, localApi, id, perms, codec, legacy) {
  var bootstrap
  if ('function' === typeof remoteManifest) {
    bootstrap = remoteManifest
    remoteManifest = {}
  }

  localManifest = localManifest || {}
  remoteManifest = remoteManifest || {}
  var emitter = new EventEmitter()
  if(!codec) codec = PSC

  //pass the manifest to the permissions so that it can know
  //what something should be.
  var _cb
  var context = {
      _emit: function (event, value) {
        emitter && emitter._emit(event, value)
        return context
      },
      id: id
    }

  var ws = initStream(
    createLocalApi(localApi, localManifest, perms).bind(context),
    codec, function (err) {
      if(emitter.closed) return
      emitter.closed = true
      emitter.emit('closed')
      if(_cb) {
        var cb = _cb; _cb = null; cb(err)
      }
    }
  )

  createRemoteApi(emitter, remoteManifest, function (type, name, args, cb) {
    if(ws.closed) throw new Error('stream is closed')
    return ws.remoteCall(type, name, args, cb)
  }, bootstrap)

  //legacy local emit, from when remote emit was supported.
  emitter._emit = emitter.emit

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

module.exports = function (remoteManifest, localManifest, codec) {
  if(arguments.length > 3)
    return createMuxrpc.apply(this, arguments)
  return function (local, perms, id) {
    return createMuxrpc(remoteManifest, localManifest, local, id, perms, codec, true)
  }
}
