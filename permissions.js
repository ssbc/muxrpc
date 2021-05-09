'use strict'
const u = require('./util')

function toArray (str) {
  return Array.isArray(str) ? str : str.split('.')
}

function isPerms (p) {
  return (
    p &&
    typeof p.pre === 'function' &&
    typeof p.test === 'function' &&
    typeof p.post === 'function'
  )
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

module.exports = function Permissions (opts) {
  if (isPerms(opts)) return opts
  if (typeof opts === 'function') return { pre: opts }
  let allow = null
  let deny = {}

  function perms (opts) {
    if (opts.allow) {
      allow = {}
      for (const path of opts.allow) {
        u.set(allow, toArray(path), true)
      }
    } else {
      allow = null
    }

    if (opts.deny) {
      for (const path of opts.deny) {
        u.set(deny, toArray(path), true)
      }
    } else {
      deny = {}
    }

    return this
  }

  if (opts) perms(opts)

  perms.pre = (name) => {
    name = Array.isArray(name) ? name : [name]
    if (allow && !u.prefix(allow, name)) {
      return new Error(`method:${name} is not in list of allowed methods`)
    }

    if (deny && u.prefix(deny, name)) {
      return new Error(`method:${name} is on list of disallowed methods`)
    }
  }

  perms.post = () => {
    // TODO
  }

  // alias for pre, used in tests.
  perms.test = (name) => perms.pre(name)

  perms.get = () => ({ allow, deny })

  return perms
}
