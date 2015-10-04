'use strict';
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

module.exports = function (opts) {
  var allow = null
  var deny = {}

  function perms (opts) {
    if(opts.allow) {
      allow = {}
      opts.allow.forEach(function (path) {
        u.set(allow, toArray(path), true)
      })
    }
    else allow = null

    if(opts.deny)
      opts.deny.forEach(function (path) {
        u.set(deny, toArray(path), true)
      })
    else deny = {}

    return this
  }

  if(opts) perms(opts)

  perms.pre = function (name, args) {
    name = isArray(name) ? name : [name]
    if(allow && !u.prefix(allow, name))
      return new Error('method:'+name + ' is not on whitelist')

    if(deny && u.prefix(deny, name))
      return new Error('method:'+name + ' is on blacklist')
  }

  perms.post = function (err, value) {
    //TODO
  }

  perms.test = function (name, args) {
    return perms.pre(name, args)
  }

  perms.get = function () {
    return {allow: allow, deny: deny}
  }

  return perms
}
