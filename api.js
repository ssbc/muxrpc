'use strict';
var EventEmitter = require('events').EventEmitter
var u = require('./util')
var explain = require('explain-error')

function isFunction (f) {
  return 'function' === typeof f
}

function isObject (o) {
  return o && 'object' === typeof o
}

function noop (err) {
//  if (err) throw explain(err, 'callback not provided')
}

module.exports = function (path, remoteApi, _remoteCall, bootstrap) {

  var emitter = new EventEmitter()

  function remoteCall(type, name, args) {
    var cb = isFunction (args[args.length - 1]) ? args.pop() : noop
    var value

    try { value = _remoteCall(type, name, args, cb) }
    catch(err) { return u.errorAsStreamOrCb(type, err, cb)}

    return value
  }

  //add all the api methods to the emitter recursively
  function recurse (obj, api, path) {
    for(var name in api) (function (name, type) {
      var _path = path ? path.concat(name) : [name]
      obj[name] =
          isObject(type)
        ? recurse({}, type, _path)
        : function () {
            return remoteCall(type, _path, [].slice.call(arguments))
          }
    })(name, api[name])
    return obj
  }

  if (bootstrap) {
    remoteCall('async', 'manifest', [function (err, remote) {
      if(err)
        return bootstrap(err)
      recurse(emitter, remote, path)
      bootstrap(null, remote, emitter)
    }])
  } else {
    recurse(emitter, remoteApi, path)
  }

  //legacy local emit, from when remote emit was supported.
  emitter._emit = emitter.emit

  return emitter
}
