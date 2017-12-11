var tape = require('tape')
var pull = require('pull-stream')
var pushable = require('pull-pushable')
var mux = require('../')
var cont = require('cont')

var api = {
  get    : 'async',
  put    : 'async',
  del    : 'async',
  read   : 'source',
  nested: {
    get    : 'async',
    put    : 'async',
    del    : 'async',
    read   : 'source',
  },
  manifest: 'sync'
}

function id (e) {
  return e
}

var store = {
  foo: 1,
  bar: 2,
  baz: 3
}

function createServerAPI (store) {
  var rpc
  var name = 'nobody'

  //this wraps a session.

  var session = {
    whoami: function (cb) {
      cb(null, {okay: true, user: name})
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
      return pull.values([1,2,3])
    },
    manifest: function () {
      return api
    }
  }

  session.nested = session

  return rpc = mux(null, api, id)(session, {allow: ['manifest', 'get']})
}

function noop () {}

function createClientAPI(cb) {
  return mux(cb, null, id)()
}

tape('secure rpc', async function (t) {

  var afterBootstrap = function () {
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
    ])(function (err) {
      t.end()
    })
  }

  var server = createServerAPI(store)
  var client = createClientAPI(afterBootstrap)

  var ss = server.createStream()
  var cs = client.createStream()

  pull(cs, ss, cs)
})
