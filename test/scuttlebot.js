const tape = require('tape')
const pull = require('pull-stream')
const Muxrpc = require('../')

const manifest = { hello: 'sync' }
const api = {
  hello (n) {
    this.emit('hello', n)
    if (process.env.TEST_VERBOSE) console.log('hello from ' + this.id)
    return n + ':' + this.id
  }
}

tape('give a muxrpc instance an id', (t) => {
  const bob = Muxrpc(null, manifest, api)
  const alice = Muxrpc(manifest, null)
  pull(alice.stream, bob.stream, alice.stream)

  bob.id = 'Alice'

  alice.hello('bob', (err, data) => {
    t.notOk(err)
    t.equal(data, 'bob:Alice')
    t.end()
  })
})

tape.skip('initialize muxrpc with an id', (t) => {
  const bob = Muxrpc(null, manifest, api)
  const alice = Muxrpc(manifest, null)
  pull(alice.stream, bob.stream, alice.stream)
  bob.id = 'Alice'

  alice.hello('bob', (err, data) => {
    t.notOk(err)
    t.equal(data, 'bob:Alice')
    t.end()
  })
})

tape('emit an event from the called api function', (t) => {
  t.plan(3)

  const bob = Muxrpc(null, manifest, api)
  const alice = Muxrpc(manifest)
  pull(alice.stream, bob.stream, alice.stream)

  bob.id = 'Alice'

  bob.on('hello', (n) => {
    if (process.env.TEST_VERBOSE) console.log('HELLO')
    t.equal(n, 'bob')
  })
  alice.hello('bob', (err, data) => {
    t.notOk(err)
    t.equal(data, 'bob:Alice')
  })
})
