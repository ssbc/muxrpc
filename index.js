
var pullWeird = require('./pull-weird')
var PacketStream = require('packet-stream')
var EventEmitter = require('events').EventEmitter
var PullSerializer = require('pull-serializer')

function isFunction (f) {
  return 'function' === typeof f
}

function isString (s) {
  return 'string' === typeof s
}

module.exports = function (remoteApi, localApi, serializer) {
  localApi = localApi || {}
  remoteApi = remoteApi || {}

  return function (local) {
    local = local || {}

    var emitter = new EventEmitter ()

    function hasAsync(name) {
      return (
        localApi.async
        && ~localApi.async.indexOf(name)
        && isFunction(local[name])
      )
    }

    function hasSource(name) {
      return (
        localApi.source
        && ~localApi.source.indexOf(name)
        && isFunction(local[name])
      )
    }

    var ps = PacketStream({
      request: function (opts, cb) {
        var name = opts.name
        if(!hasAsync(name))
          return cb(new Error('method not supported:'+name))
        var args = opts.args
        args.push(cb)
        //packet stream already has a thing to check cb fires only once.
        try { local[name].apply(local, args) }
        catch (err) { cb(isString(err) ? new Error(err) : err) }
      },
      stream: function (stream) {
        stream.read = function (data, end) {
          console.log(data)
          var name = data.name
          stream.read = null
          if(end) return stream.write(null, end)

          if(!hasSource(name))
            return stream.write(null, new Error('no source:'+name))

          pullWeird.sink(stream) (local[name].apply(local, data.args))
        }
      }
    })

    if(remoteApi.async)
      remoteApi.async.forEach(function (name) {
        console.log('add async', name)
        emitter[name] = function () {
          var args = [].slice.call(arguments)
          var cb = args.pop()
          if(!isFunction (cb))
            throw new Error('callback must be provided')

          console.log('request:', {call: name, args: args})
          ps.request({name: name, args: args}, cb)
        }
      })

    if(remoteApi.source)
      remoteApi.source.forEach(function (name) {
        console.log('add async', name)
        emitter[name] = function () {
          var args = [].slice.call(arguments)
          var ws = ps.stream()
          var s = pullWeird.source(ws)
          ws.write({name: name, args: args, type: 'source'})
          return s
        }

      })


    emitter.createStream = function () {
      var pullPs = pullWeird(ps)
      if (serializer)
        pullPs = PullSerializer(pullPs, serializer)
      return pullPs
    }

    return emitter

  }
}
