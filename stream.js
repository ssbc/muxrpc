'use strict';
var pull         = require('pull-stream')
var goodbye      = require('pull-goodbye')
var u            = require('./util')
var explain      = require('explain-error')
var PushMux      = require('push-mux')

var toPull = require('./push-to-pull')

function isFunction (f) {
  return 'function' === typeof f
}

function isString (s) {
  return 'string' === typeof s
}

function isObject (o) {
  return o && 'object' === typeof o
}

function isSource    (t) { return 'source' === t }
function isSink      (t) { return 'sink'   === t }
function isDuplex    (t) { return 'duplex' === t }
function isSync      (t) { return 'sync'  === t }
function isAsync     (t) { return 'async'  === t }
function isRequest   (t) { return isSync(t) || isAsync(t) }
function isStream    (t) { return isSource(t) || isSink(t) || isDuplex(t) }

module.exports = function initStream (localCall, codec, onClose) {

  var ps = new PushMux({
    credit: 64*1024*1024, //that's a very small default window. only packets
    onMessage: function (msg) {},
    onRequest: function (opts, cb) {
      var name = opts.name, args = opts.args
      var inCB = false, called = false, async = false, value

      args.push(function (err, value) {
        called = true
        inCB = true;
        cb(err, value)
      })
      try {
        value = localCall('async', name, args)
        async = true
      } catch (err) {
        if(inCB || called) throw explain(err, 'no callback provided to muxrpc async funtion')
        return cb(err)
      }

    },
    onStream: function (stream, data) {
      var _stream
      try {
        _stream = localCall(data.type, data.name, data.args)
      } catch (err) {
        return stream.end(err)
      }
      if(data.type == 'source')
        pull(_stream, toPull.sink(stream))
      else if(data.type == 'sink')
        pull(toPull.source(stream), _stream)
      else if(data.type == 'duplex')
        pull(_stream, toPull.duplex(stream), _stream)
    },
    onClose: function (err) {
      ps = null // deallocate
      ws.ended = true
      if(ws.closed) return
      ws.closed = true
      if(onClose) {
        var close = onClose; onClose = null; close(err === true ? null : err)
      }
    }
  })

  var ws = goodbye(toPull.duplex(ps))

  //used with muxrpc, this means
  ws = codec ? codec(ws) : ws

  ws.remoteCall = function (type, name, args, cb) {
    if(name === 'emit') return ps.message(args)

    if(!(isRequest(type) || isStream(type)))
      throw new Error('unsupported type:' + JSON.stringify(type))

    if(isRequest(type))
      return ps.request({name: name, args: args}, cb)

    var ws = ps.stream({name: name, args: args, type: type})
    var s = toPull[type](ws, cb)
    return s
  }

  // is this used anywhere?
  ws.isOpen = function () {
    return !ps.ended
  }

  ws.close = function (err, cb) {
    if(isFunction(err))
      cb = err, err = false
    if(!ps) return (cb && cb())
    ps.abort(err)
    cb && cb()
    return this
  }
  ws.closed = false

  return ws
}
