'use strict'
const pull = require('pull-stream')

function isEmpty (obj) {
  if (!obj) return true
  return Object.keys(obj).length === 0
}

// I wrote set as part of permissions.js
// and then later mount, they do nearly the same thing
// but not quite. this should be refactored sometime.
// what differs is that set updates the last key in the path
// to the new value, but mount merges the last value
// which makes sense if it's an object, and set makes sense if it's
// a string/number/boolean.

exports.set = function set (obj, path, value) {
  let _obj, _k
  for (let i = 0; i < path.length; i++) {
    const k = path[i]
    obj[k] = obj[k] || {}
    _obj = obj
    _k = k
    obj = obj[k]
  }
  _obj[_k] = value
}

exports.get = function get (obj, path) {
  if (typeof path === 'string') return obj[path]
  let value
  for (let i = 0; i < path.length; i++) {
    const k = path[i]
    value = obj = obj[k]
    if (obj == null) return obj
  }
  return value
}

exports.prefix = function prefix (obj, path) {
  let value

  for (let i = 0; i < path.length; i++) {
    const k = path[i]
    value = obj = obj[k]
    if (typeof obj !== 'object') {
      return obj
    }
  }
  return typeof value !== 'object' ? !!value : false
}

function mkPath (obj, path) {
  for (const i in path) {
    const key = path[i]
    if (!obj[key]) obj[key] = {}
    obj = obj[key]
  }
  return obj
}

function rmPath (obj, path) {
  (function r (obj, i) {
    const key = path[i]
    if (!obj) return
    else if (path.length - 1 === i) {
      delete obj[key]
    } else if (i < path.length) r(obj[key], i + 1)
    if (isEmpty(obj[key])) delete obj[key]
  })(obj, 0)
}

function merge (obj, _obj) {
  for (const k in _obj) {
    obj[k] = _obj[k]
  }
  return obj
}

exports.mount = function mount (obj, path, _obj) {
  if (!Array.isArray(path)) {
    throw new Error('path must be array of strings')
  }
  return merge(mkPath(obj, path), _obj)
}

exports.unmount = function unmount (obj, path) {
  return rmPath(obj, path)
}

const isSource = (t) => t === 'source'
const isSink = (t) => t === 'sink'
const isDuplex = (t) => t === 'duplex'
const isSync = (t) => t === 'sync'
const isAsync = (t) => t === 'async'
const isRequest = (t) => isSync(t) || isAsync(t)
const isStream = (t) => isSource(t) || isSink(t) || isDuplex(t)

exports.isRequest = isRequest
exports.isStream = isStream

function abortSink (err) {
  return function (read) {
    read(err || true, () => {})
  }
}

function abortDuplex (err) {
  return { source: pull.error(err), sink: abortSink(err) }
}

exports.errorAsStream = function errorAsStream (type, err) {
  return isSource(type)
    ? pull.error(err)
    : isSink(type)
      ? abortSink(err)
      : abortDuplex(err)
}

exports.errorAsStreamOrCb = function errorAsStreamOrCb (type, err, cb) {
  return isRequest(type)
    ? cb(err)
    : isDuplex(type)
      ? abortDuplex(err)
      : isSource(type)
        ? pull.error(err)
        : isSink(type)
          ? abortSink(err)
          : cb(err)
}

exports.pipeToStream = function pipeToStream (type, _stream, stream) {
  if (isSource(type)) {
    _stream(stream)
  } else if (isSink(type)) {
    stream(_stream)
  } else if (isDuplex(type)) {
    pull(_stream, stream, _stream)
  }
}
