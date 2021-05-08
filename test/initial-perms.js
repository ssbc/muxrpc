const tape = require('tape')
const pull = require('pull-stream')
const mux = require('../')
const cont = require('cont')

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

function id (e) {
  return e
}

const store = {
  foo: 1,
  bar: 2,
  baz: 3
}

function createServerAPI (store) {
  const name = 'nobody'

  // this wraps a session.

  const session = {
    whoami: function (cb) {
      cb(null, { okay: true, user: name })
    },
    get: function (key, cb) {
      return cb(null, store[key])
    },
    put: function (key, value, cb) {
      store[key] = value
      cb()
    },
    del: function (key, cb) {
      delete store[key]
      cb()
    },
    read: function () {
      return pull.values([1, 2, 3])
    }
  }

  session.nested = session

  return mux(null, api, id)(session, { allow: ['get'] })
}

function createClientAPI () {
  return mux(api, null, id)()
}

tape('secure rpc', function (t) {
  const server = createServerAPI(store)
  const client = createClientAPI()

  const ss = server.createStream()
  const cs = client.createStream()

  pull(cs, ss, cs)

  cont.para([
    function (cb) {
      client.get('foo', function (err) {
        t.notOk(err); cb()
      })
    },
    function (cb) {
      client.put('foo', function (err) {
        t.ok(err); cb()
      })
    },
    function (cb) {
      client.del('foo', function (err) {
        t.ok(err); cb()
      })
    },
    function (cb) {
      pull(client.read(), pull.collect(function (err) {
        t.ok(err); cb()
      }))
    }
  ])(function () {
    t.end()
  })
})
