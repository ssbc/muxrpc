const tape = require('tape')
const pull = require('pull-stream')
const Muxrpc = require('../')

const manifest = { hello: 'sync' }
const api = {
  hello (n) {
    if (this._emit) this._emit('hello', n)
    if (process.env.TEST_VERBOSE) console.log('hello from ' + this.id)
    return n + ':' + this.id
  }
}

tape('give a muxrpc instance an id', (t) => {
  const bob = Muxrpc(null, manifest)(api)
  const alice = Muxrpc(manifest, null)()
  const as = alice.createStream()
  pull(as, bob.createStream(), as)

  bob.id = 'Alice'

  alice.hello('bob', (err, data) => {
    t.notOk(err)
    t.equal(data, 'bob:Alice')
    t.end()
  })
})

tape('initialize muxrpc with an id', (t) => {
  const bob = Muxrpc(null, manifest)(api, null, 'Alice')
  const alice = Muxrpc(manifest, null)()
  const as = alice.createStream()
  pull(as, bob.createStream(), as)

  alice.hello('bob', (err, data) => {
    t.notOk(err)
    t.equal(data, 'bob:Alice')
    t.end()
  })
})

tape('emit an event from the called api function', (t) => {
  t.plan(3)

  const bob = Muxrpc(null, manifest)(api)
  const alice = Muxrpc(manifest, null)()
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
