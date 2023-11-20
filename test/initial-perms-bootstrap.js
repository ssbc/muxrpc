const tape = require('tape')
const pull = require('pull-stream')
const cont = require('cont')
const mux = require('../')

const manifest = {
  get: 'async',
  put: 'async',
  del: 'async',
  read: 'source',
  nested: {
    get: 'async',
    put: 'async',
    del: 'async',
    read: 'source'
  },
  manifest: 'sync'
}

const store = {
  foo: 1,
  bar: 2,
  baz: 3
}

function createServerAPI (store) {
  const name = 'nobody'

  // this wraps a session.

  const local = {
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
    },
    manifest () {
      return manifest
    }
  }

  local.nested = local

  return mux(null, manifest, local, { allow: ['manifest', 'get'] })
}

function createClientAPI (cb) {
  return mux(cb)
}

tape('secure rpc', (t) => {
  const afterBootstrap = () => {
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
  }

  const server = createServerAPI(store)
  const client = createClientAPI(afterBootstrap)

  const ss = server.stream
  const cs = client.stream

  pull(cs, ss, cs)
})
