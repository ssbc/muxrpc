
var Permissions  = require('./permissions')
var u            = require('./util')

module.exports = 

function createLocalCall(local, localApi, perms) {
  perms = Permissions(perms)

  function has(type, name) {
    return type === u.get(localApi, name)
  }

  function localCall(type, name, args) {

    if(name === 'emit')
      throw new Error('emit has been removed')

    //is there a way to know whether it's sync or async?
    if(type === 'async')
      if(has('sync', name)) {
        var cb = args.pop(), value
        try { value = u.get(local, name).apply(this, args) }
        catch (err) { return cb(err) }
        return cb(null, value)
      }

    if (!has(type, name))
      throw new Error('no '+type+':'+name)

    return u.get(local, name).apply(this, args)
  }

  return function (type, name, args) {
    var err = perms.pre(name, args)
    if(err) throw err
    return localCall.call(this, type, name, args)
  }
}

