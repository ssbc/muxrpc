'use strict'
const u = require('./util')
const explain = require('explain-error')

function isFunction (f) {
  return typeof f === 'function'
}

function isObject (o) {
  return o && typeof o === 'object'
}

// add all the api methods to the emitter recursively
function recurse (obj, manifest, path, remoteCall) {
  for (const name in manifest) {
    (function (name, type) {
      const _path = path ? path.concat(name) : [name]
      obj[name] =
        isObject(type)
          ? recurse({}, type, _path, remoteCall)
          : function () {
            return remoteCall(type, _path, [].slice.call(arguments))
          }
    })(name, manifest[name])
  }
  return obj
}

function noop (err) {
  if (err) {
    throw explain(err, 'callback not provided')
  }
}

const promiseTypes = [
  'sync',
  'async'
]

module.exports = function (obj, manifest, _remoteCall, bootstrap) {
  obj = obj || {}

  function remoteCall (type, name, args) {
    const cb = isFunction(args[args.length - 1])
      ? args.pop()
      : promiseTypes.includes(type)
        ? null
        : noop
    let value

    if (typeof cb === 'function') {
      // Callback style
      try {
        value = _remoteCall(type, name, args, cb)
      } catch (err) {
        return u.errorAsStreamOrCb(type, err, cb)
      }

      return value
    } else {
      // Promise style
      return new Promise((resolve, reject) =>
        _remoteCall(type, name, args, (err, val) => {
          if (err) {
            reject(err)
          } else {
            resolve(val)
          }
        })
      )
    }
  }

  if (bootstrap) {
    remoteCall('async', 'manifest', [function (err, remote) {
      if (err) return bootstrap(err)
      recurse(obj, remote, null, remoteCall)
      bootstrap(null, remote, obj)
    }])
  } else {
    recurse(obj, manifest, null, remoteCall)
  }

  return obj
}
