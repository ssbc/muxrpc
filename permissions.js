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

/*

perms:

a given capability may be permitted to call a particular api.
but only if a perms function returns true for the arguments
it passes.

suppose, an app may be given access, but may only create functions
with it's own properties.

create perms:
  {
    allow: ['add', 'query'], deny: [...],
    rules: {
      add: {
        call: function (value) {
          return (value.type === 'task' || value.type === '_task')
        },
      query: {
        call: function (value) {
          safe.contains(value, {path: ['content', 'type'], eq: 'task'}) ||
          safe.contains(value, {path: ['content', 'type'], eq: '_task'})
        },
        filter: function (value) {
          return (value.type === 'task' || value.type === '_task')
        }
      }
    }
  }
*/

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

  perms.pre = function (name, args) {
    name = isArray(name) ? name : [name]
    if(whitelist && !u.prefix(whitelist, name))
      return new Error('method:'+name + ' is not on whitelist')

    if(blacklist && u.prefix(blacklist, name))
      return new Error('method:'+name + ' is on blacklist')
  }

  perms.post = function (err, value) {
    //TODO
  }

  perms.test = function (name, args) {
    return perms.pre(name, args)
  }

  return perms
}
