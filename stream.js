'use strict'
const PacketStream = require('packet-stream')
const pullWeird = require('./pull-weird')
const goodbye = require('pull-goodbye')
const u = require('./util')
const explain = require('explain-error')

module.exports = function initStream (localCall, codec, onClose) {
  let ps = PacketStream({
    message () {
      // if (isString(msg)) return
      // if (msg.length > 0 && isString(msg[0]))
      //   localCall('msg', 'emit', msg)
    },
    request (opts, cb) {
      if (!Array.isArray(opts.args)) {
        return cb(new Error(`invalid request, args should be array, was: ${JSON.stringify(opts)}`))
      }
      const name = opts.name
      const args = opts.args
      let inCB = false
      let called = false

      args.push((err, value) => {
        called = true
        inCB = true
        cb(err, value)
      })
      try {
        localCall('async', name, args)
      } catch (err) {
        if (inCB || called) {
          throw explain(err, 'no callback provided to muxrpc async funtion')
        }
        cb(err)
      }
    },
    stream (stream) {
      stream.read = function read (data, end) {
        // how would this actually happen?
        if (end) return stream.write(null, end)

        const { name, type, args } = data
        let err, value

        stream.read = null

        if (!u.isStream(type)) {
          return stream.write(null, new Error(`unsupported stream type: ${type}`))
        }

        try {
          value = localCall(type, name, args)
        } catch (_err) {
          err = _err
        }

        const antiType =
          type === 'source'
            ? 'sink'
            : type === 'sink'
              ? 'source'
              : 'duplex'
        const _stream = pullWeird[antiType](stream)

        return u.pipeToStream(
          type,
          _stream,
          err ? u.errorAsStream(type, err) : value
        )

        //        if(isSource(type))
        //          _stream(err ? pull.error(err) : value)
        //        else if (isSink(type))
        //          (err ? abortSink(err) : value)(_stream)
        //        else if (isDuplex(type))
        //          pull(_stream, err ? abortDuplex(err) : value, _stream)
      }
    },

    close (err) {
      ps = null // deallocate
      ws.ended = true
      if (ws.closed) return
      ws.closed = true
      if (onClose) {
        const close = onClose
        onClose = null
        close(err)
      }
    }
  })

  let ws = goodbye(pullWeird(ps, () => {
    // this error will be handled in PacketStream.close
  }))

  ws = codec ? codec(ws) : ws

  ws.remoteCall = function (type, name, args, cb) {
    if (name === 'emit') return ps.message(args)

    if (!(u.isRequest(type) || u.isStream(type))) {
      throw new Error(`unsupported type: ${JSON.stringify(type)}`)
    }

    if (u.isRequest(type)) {
      return ps.request({ name, args }, cb)
    }

    const ws = ps.stream()
    const s = pullWeird[type](ws, cb)
    ws.write({ name, args, type })
    return s
  }

  // hack to work around ordering in setting ps.ended.
  // Question: if an object has subobjects, which
  // all have close events, should the subobjects fire close
  // before the parent? or should parents close after?
  // should there be a preclose event on the parent
  // that fires when it's about to close all the children?
  ws.isOpen = function () {
    return !ps.ended
  }

  ws.close = function (err, cb) {
    if (typeof err === 'function') {
      cb = err
      err = false
    }
    if (!ps) {
      if (cb) cb()
      return
    }
    if (err) {
      ps.destroy(err)
      if (cb) cb()
      return
    }

    ps.close((err) => {
      if (cb) cb(err)
      else if (err) throw explain(err, 'no callback provided for muxrpc close')
    })

    return this
  }
  ws.closed = false

  return ws
}
