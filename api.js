'use strict';
var EventEmitter = require('events').EventEmitter
var u = require('./util')

function isFunction (f) {
  return 'function' === typeof f
}

function isObject (o) {
  return o && 'object' === typeof o
}

function noop (err) {
  if (err) throw err
}

module.exports =    function createApi(path, remoteApi, _remoteCall) {

  var emitter = new EventEmitter()

  function remoteCall(type, name, args) {
    var cb = isFunction (args[args.length - 1]) ? args.pop() : noop
    var value

    try { value = _remoteCall(type, name, args, cb) }
    catch(err) { return u.errorAsStreamOrCb(type, err, cb)}

    return value
  }

  //add all the api methods to emitter recursively
  ;(function recurse (obj, api, path) {
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
  })(emitter, remoteApi, path)

  emitter._emit = emitter.emit

  emitter.emit = function () {
    var args = [].slice.call(arguments)
    if(args.length == 0) return
    remoteCall('msg', 'emit', args)
  }

  return emitter
}

