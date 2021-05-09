'use strict'
const PacketStreamCodec = require('packet-stream-codec')
const EventEmitter = require('events').EventEmitter
const initStream = require('./stream')
const createRemoteApi = require('./remote-api')
const createLocalApi = require('./local-api')

function createMuxrpc (remoteManifest, localManifest, localApi, id, perms, codec, legacy) {
  let bootstrapCB
  if (typeof remoteManifest === 'function') {
    bootstrapCB = remoteManifest
    remoteManifest = {}
  }

  localManifest = localManifest || {}
  remoteManifest = remoteManifest || {}
  const emitter = new EventEmitter()
  if (!codec) codec = PacketStreamCodec

  // pass the manifest to the permissions so that it can know
  // what something should be.
  let _cb
  const context = {
    _emit (event, value) {
      if (emitter) emitter._emit(event, value)
      return context
    },
    id
  }

  const ws = initStream(
    createLocalApi(localApi, localManifest, perms).bind(context),
    codec,
    (err) => {
      if (emitter.closed) return
      emitter.closed = true
      emitter.emit('closed')
      if (_cb) {
        const cb = _cb
        _cb = null
        cb(err)
      }
    }
  )

  createRemoteApi(
    emitter,
    remoteManifest,
    (type, name, args, cb) => {
      if (ws.closed) throw new Error('stream is closed')
      return ws.remoteCall(type, name, args, cb)
    },
    bootstrapCB
  )

  // legacy local emit, from when remote emit was supported.
  emitter._emit = emitter.emit

  if (legacy) {
    Object.__defineGetter__.call(emitter, 'id', () => context.id)
    Object.__defineSetter__.call(emitter, 'id', (value) => { context.id = value })

    let first = true
    emitter.createStream = (cb) => {
      _cb = cb
      if (first) {
        first = false
        return ws
      } else {
        throw new Error('one stream per rpc')
      }
    }
  } else {
    emitter.stream = ws
  }

  emitter.closed = false

  emitter.close = function (err, cb) {
    ws.close(err, cb)
    return this
  }

  return emitter
}

module.exports = function (remoteManifest, localManifest, codec) {
  if (arguments.length > 3) {
    return createMuxrpc.apply(this, arguments)
  }
  return function (local, perms, id) {
    return createMuxrpc(remoteManifest, localManifest, local, id, perms, codec, true)
  }
}
