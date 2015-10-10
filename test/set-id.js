
var pull = require('pull-stream')
var tape = require('tape')
var Muxrpc = require('../')

tape('give a muxrpc instance an id', function (t) {

  var manifest = { hello: 'sync' }

  var api = {
    hello: function (n) {
      console.log('hello from ' + this.id)
      return n + ':' + this.id
    }
  }

  var bob = Muxrpc(null, manifest)  (api)
  var alice = Muxrpc(manifest, null)  ()

  var as = alice.createStream()

  pull(as, bob.createStream(), as)

  bob.id = 'Alice'

  alice.hello('bob', function (err, data) {
    t.notOk(err)
    t.equal(data, 'bob:Alice')
    t.end()
  })
})
