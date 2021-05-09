const pull = require('pull-stream')
const tape = require('tape')
const Muxrpc = require('../')

const manifest = { hello: 'sync', manifest: 'sync' }
const api = {
  hello (n) {
    if (this._emit) this._emit('hello', n)
    if (process.env.TEST_VERBOSE) console.log('hello from ' + this.id)
    return n + ':' + this.id
  },
  manifest () {
    return manifest
  }
}

tape('emit an event from the called api function', (t) => {
  t.plan(6)

  const bob = Muxrpc(null, manifest)(api)
  const cb = (err, val, emitter) => {
    t.notOk(err)
    t.deepEqual(manifest, val)
    t.ok(emitter)
  }

  const alice = Muxrpc(cb)()
  const as = alice.createStream()
  pull(as, bob.createStream(), as)

  bob.id = 'Alice'

  bob.on('hello', (n) => {
    if (process.env.TEST_VERBOSE) console.log('HELLO')
    t.equal(n, 'bob')
  })
  alice.hello('bob', (err, data) => {
    t.notOk(err)
    t.equal(data, 'bob:Alice')
    t.end()
  })
})
