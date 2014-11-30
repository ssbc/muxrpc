var u = require('./util')

var isArray = Array.isArray

function isFunction (f) {
  return 'function' === typeof f
}

function join (str) {
  return Array.isArray(str) ? str.join('.') : str
}

function toArray(str) {
  return isArray(str) ? str : str.split('.')
}

module.exports = function () {
  var whitelist = null
  var blacklist = {}

  function perms (opts) {
    if(opts.allow) {
      whitelist = {}
      opts.allow.forEach(function (path) {
        u.set(whitelist, toArray(path), true)
      })
    }
    else whitelist = null

    if(opts.deny)
      opts.deny.forEach(function (path) {
        u.set(blacklist, toArray(path), true)
      })
    else blacklist = {}

    return this
  }

  perms.test = function (name, args) {
    name = isArray(name) ? name : [name]
    if(whitelist && !u.prefix(whitelist, name))
      return new Error('method:'+name + ' is not on whitelist')

    if(blacklist && u.prefix(blacklist, name))
      return new Error('method:'+name + ' is on blacklist')
  }

  return perms
}
