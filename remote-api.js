'use strict'
const u = require('./util')
const explain = require('explain-error')

// add all the api methods to the emitter recursively
function recurse (obj, manifest, path, remoteCall) {
  for (const name in manifest) {
    const val = manifest[name] // nested-manifest or type string
    const nestedPath = path ? path.concat(name) : [name]
    obj[name] =
      val && typeof val === 'object'
        ? recurse({}, val, nestedPath, remoteCall)
        : (...args) => remoteCall(val, nestedPath, args)
  }
  return obj
}

function noop (err) {
  if (err) {
    throw explain(err, 'callback not provided')
  }
}

module.exports = function createRemoteApi (obj, manifest, _remoteCall, bootstrap) {
  obj = obj || {}

  function remoteCall (type, name, args) {
    const cb = typeof args[args.length - 1] === 'function'
      ? args.pop()
      : type === 'sync' || type === 'async' // promise types
        ? null
        : noop

    if (typeof cb === 'function') {
      let value
      // Callback style
      try {
        value = _remoteCall(type, name, args, cb)
      } catch (err) {
        return u.errorAsStreamOrCb(type, err, cb)
      }
      return value
    } else {
      // Promise style
      return new Promise((resolve, reject) => {
        _remoteCall(type, name, args, (err, val) => {
          if (err) reject(err)
          else resolve(val)
        })
      })
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
