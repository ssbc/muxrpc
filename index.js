'use strict'
const PacketStreamCodec = require('packet-stream-codec')
const EventEmitter = require('events').EventEmitter
const initStream = require('./stream')
const createRemoteApi = require('./remote-api')
const createLocalApi = require('./local-api')

function createMuxrpc (remoteManifest, localManifest, localApi, perms, codec) {
  let bootstrapCB
  if (typeof remoteManifest === 'function') {
    bootstrapCB = remoteManifest
    remoteManifest = {}
  }

  localManifest = localManifest || {}
  remoteManifest = remoteManifest || {}
  const emitter = new EventEmitter()
  if (!codec) codec = PacketStreamCodec

  const ws = initStream(
    createLocalApi(localApi, localManifest, perms).bind(emitter),
    codec,
    () => {
      if (emitter.closed) return
      emitter.closed = true
      emitter.emit('closed')
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

  emitter.stream = ws

  emitter.closed = false

  emitter.close = function (err, cb) {
    ws.close(err, cb)
    return this
  }

  return emitter
}

module.exports = createMuxrpc
