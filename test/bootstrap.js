var pull = require('pull-stream')
var tape = require('tape')
var Muxrpc = require('../')

var manifest = { hello: 'sync', manifest: 'sync' }
var api = {
  hello: function (n) {
    if(this._emit) this._emit('hello', n)
    console.log('hello from ' + this.id)
    return n + ':' + this.id
  },
  manifest: function () {
    return manifest
  }
}

tape('emit an event from the called api function', async function (t) {

  t.plan(5)

  var bob = Muxrpc(null, manifest)  (api)
  var cb = function (err, val) {
    t.notOk(err)
    t.deepEqual(manifest, val)
  }

  var alice = Muxrpc(cb) ()
  var as = alice.createStream()
  pull(as, bob.createStream(), as)

  bob.id = 'Alice'

  bob.on('hello', function (n) {
    console.log('HELLO')
    t.equal(n, 'bob')
  })
  alice.hello('bob', function (err, data) {
    t.notOk(err)
    t.equal(data, 'bob:Alice')
    t.end()
  })
})
