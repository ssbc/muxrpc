'use strict'
var PSC          = require('packet-stream-codec')
var RPC          = require('./rpc')

module.exports = function (remoteApi, localApi, codec) {
  localApi = localApi || {}
  remoteApi = remoteApi || {}

  if(!codec) codec = PSC

  //pass the manifest to the permissions so that it can know
  //what something should be.

  return function (local, perms) {
    return RPC(codec)
      .mountRemote([], remoteApi)
      .mountLocal([], localApi, local)
      .access([], perms)
  }
}

