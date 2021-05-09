'use strict'
const explain = require('explain-error')
const u = require('./util')

/**
 * Recursively traverse the `obj` according to the `manifest` shape,
 * replacing all leafs with `remoteCall`. Returns the mutated `obj`.
 */
function recurse (obj, manifest, path, remoteCall) {
  for (const name in manifest) {
    const val = manifest[name]
    const nestedPath = path ? path.concat(name) : [name]
    if (val && typeof val === 'object') {
      const nestedManifest = val
      obj[name] = recurse({}, nestedManifest, nestedPath, remoteCall)
    } else {
      const type = val
      obj[name] = (...args) => remoteCall(type, nestedPath, args)
    }
  }
  return obj
}

function noop (err) {
  if (err) throw explain(err, 'callback not provided')
}

function createRemoteApi (obj, manifest, actualRemoteCall, bootstrapCB) {
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
        value = actualRemoteCall(type, name, args, cb)
      } catch (err) {
        return u.errorAsStreamOrCb(type, err, cb)
      }
      return value
    } else {
      // Promise style
      return new Promise((resolve, reject) => {
        actualRemoteCall(type, name, args, (err, val) => {
          if (err) reject(err)
          else resolve(val)
        })
      })
    }
  }

  if (bootstrapCB) {
    remoteCall('async', 'manifest', [function (err, manifest) {
      if (err) return bootstrapCB(err)
      recurse(obj, manifest, null, remoteCall)
      bootstrapCB(null, manifest, obj)
    }])
  } else {
    recurse(obj, manifest, null, remoteCall)
  }

  return obj
}

module.exports = createRemoteApi
