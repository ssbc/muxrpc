

function isFunction (f) {
  return 'function' === typeof f
}

module.exports = function () {
  var whitelist = null
  var blacklist = {}

  function perms (opts) {
    if(opts.allow) {
      whitelist = {}
      opts.allow.forEach(function (k) {
        whitelist[k] = true
      })
    }
    else whitelist = null

    if(opts.deny)
      opts.deny.forEach(function (k) {
        blacklist[k] = true
      })
    else blacklist = {}

    return this
  }

  perms.test = function (name, args) {
      if(whitelist && !whitelist[name])
        return new Error('method:'+name + ' is not on whitelist')
      if(blacklist[name])
        return new Error('method:'+name + ' is on blacklist')
    }

  return perms
}
