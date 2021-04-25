var pull = require('pull-stream')
var tape = require('tape')
var Muxrpc = require('../')

var manifest = { hello: 'sync', manifest: 'sync' }
var api = {
  hello: function (n) {
    if(this._emit) this._emit('hello', n)
    if (process.env.TEST_VERBOSE) console.log('hello from ' + this.id)
    return n + ':' + this.id
  },
  manifest: function () {
    return manifest
  }
}

tape('emit an event from the called api function', function (t) {

  t.plan(6)

  var bob = Muxrpc(null, manifest)  (api)
  var cb = function (err, val, emitter) {
    t.notOk(err)
    t.deepEqual(manifest, val)
    t.ok(emitter)
  }

  var alice = Muxrpc(cb) ()
  var as = alice.createStream()
  pull(as, bob.createStream(), as)

  bob.id = 'Alice'

  bob.on('hello', function (n) {
    if (process.env.TEST_VERBOSE) console.log('HELLO')
    t.equal(n, 'bob')
  })
  alice.hello('bob', function (err, data) {
    t.notOk(err)
    t.equal(data, 'bob:Alice')
    t.end()
  })
})
