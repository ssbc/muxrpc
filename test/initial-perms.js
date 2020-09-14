var tape = require('tape')
var pull = require('pull-stream')
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
  }
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
    }
  }

  session.nested = session

  return mux(null, api, id)(session, {allow: ['get']})
}

function createClientAPI() {
  return mux(api, null, id)()
}

tape('secure rpc', function (t) {

  var server = createServerAPI(store)
  var client = createClientAPI()

  var ss = server.createStream()
  var cs = client.createStream()

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


