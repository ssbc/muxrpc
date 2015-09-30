var PacketStream = require('packet-stream')
var pull         = require('pull-stream')
var pullWeird    = require('./pull-weird')
var u            = require('./util')
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

function noop (err) {
  if (err) throw err
}

module.exports = function createPacketStream (localCall, closed) {

  var stream = PacketStream({
    message: function (msg) {
      if(isString(msg)) return
      if(msg.length > 0 && isString(msg[0]))
        localCall('emit', msg)
    },
    request: function (opts, cb) {
      var name = opts.name, args = opts.args
      var inCB = false, called = false, async = false, value

      args.push(function (err, value) {
        called = true
        inCB = true; cb(err, value)
      })
      try {
        value = localCall(name, args, 'async')
      } catch (err) {
        if(inCB || called) throw err
        return cb(err)
      }

    },
    stream: function (stream) {
      stream.read = function (data, end) {
        var name = data.name
        var type = data.type
        var err, value

        stream.read = null

        if(!isStream(type))
          return stream.write(null, new Error('unsupported stream type:'+type))

        //how would this actually happen?
        if(end) return stream.write(null, end)

        try { value = localCall(name, data.args, type) }
        catch (_err) { err = _err }

        var _stream = pullWeird[
          {source: 'sink', sink: 'source'}[type] || 'duplex'
        ](stream)

        return u.pipeToStream(
          type, _stream,
          err ? u.errorAsStream(type, err) : value
        )

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

  stream.callMethod = function callMethod(name, type, args, cb) {
    if(name === 'emit') return stream.message(args)

    if(!(isRequest(type) || isStream(type)))
      throw new Error('unsupported type:' + JSON.stringify(type))

    if(isRequest(type))
      return stream.request({name: name, args: args}, cb)

    var ws = stream.stream(), s = pullWeird[type](ws, cb)
    ws.write({name: name, args: args, type: type})
    return s
  }

  return stream

}

