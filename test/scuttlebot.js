
var pull = require('pull-stream')
var tape = require('tape')
var Muxrpc = require('../')

var manifest = { hello: 'sync' }
var api = {
  hello: function (n) {
    if(this._emit) this._emit('hello', n)
    if (process.env.TEST_VERBOSE) console.log('hello from ' + this.id)
    return n + ':' + this.id
  }
}

tape('give a muxrpc instance an id', function (t) {

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


tape('initialize muxrpc with an id', function (t) {

  var bob = Muxrpc(null, manifest)  (api, null, 'Alice')
  var alice = Muxrpc(manifest, null)  ()
  var as = alice.createStream()
  pull(as, bob.createStream(), as)

  alice.hello('bob', function (err, data) {
    t.notOk(err)
    t.equal(data, 'bob:Alice')
    t.end()
  })
})


tape('emit an event from the called api function', function (t) {

  t.plan(3)

  var bob = Muxrpc(null, manifest)  (api)
  var alice = Muxrpc(manifest, null)  ()
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
