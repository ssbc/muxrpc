const tape = require('tape')
const pull = require('pull-stream')
const cont = require('cont')
const mux = require('../')

const api = {
  get: 'async',
  put: 'async',
  del: 'async',
  read: 'source',
  nested: {
    get: 'async',
    put: 'async',
    del: 'async',
    read: 'source'
  }
}

const id = (e) => e

const store = {
  foo: 1,
  bar: 2,
  baz: 3
}

function createServerAPI (store) {
  const name = 'nobody'

  // this wraps a session.

  const session = {
    whoami (cb) {
      cb(null, { okay: true, user: name })
    },
    get (key, cb) {
      return cb(null, store[key])
    },
    put (key, value, cb) {
      store[key] = value
      cb()
    },
    del (key, cb) {
      delete store[key]
      cb()
    },
    read () {
      return pull.values([1, 2, 3])
    }
  }

  session.nested = session

  return mux(null, api, id)(session, { allow: ['get'] })
}

function createClientAPI () {
  return mux(api, null, id)()
}

tape('secure rpc', (t) => {
  const server = createServerAPI(store)
  const client = createClientAPI()

  const ss = server.createStream()
  const cs = client.createStream()

  pull(cs, ss, cs)

  cont.para([
    (cb) => {
      client.get('foo', (err) => {
        t.notOk(err); cb()
      })
    },
    (cb) => {
      client.put('foo', (err) => {
        t.ok(err); cb()
      })
    },
    (cb) => {
      client.del('foo', (err) => {
        t.ok(err); cb()
      })
    },
    (cb) => {
      pull(client.read(), pull.collect((err) => {
        t.ok(err); cb()
      }))
    }
  ])(() => {
    t.end()
  })
})
