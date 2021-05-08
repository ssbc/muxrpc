const tape = require('tape')
const pull = require('pull-stream')
const mux = require('../')
const cont = require('cont')
const Permissions = require('../permissions')

const api = {
  login: 'async',
  logout: 'async',
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
  let name = 'nobody'

  // this wraps a session.

  const perms = Permissions({ allow: ['login'] })

  const session = {
    // implement your own auth function.
    // it should just set the allow and deny lists.

    login: function (opts, cb) {
      if (opts.name === 'user' && opts.pass === 'password') { // allow read operations
        perms({ deny: ['put', 'del'], allow: null })
      } else if (opts.name === 'admin' && opts.pass === 'admin') { // allow write operations
        perms({ deny: null, allow: null })
      } else if (opts.name === 'nested' && opts.pass === 'foofoo') { // allow everything
        perms({
        // read only access to nested methods
          allow: ['nested'],
          deny: [['nested', 'put'], ['nested', 'del']]
        })
      } else { // you are nobody!
        return cb(new Error('not authorized'))
      }

      name = opts.name

      cb(null, { okay: true, name: name })
    },
    logout: function (cb) {
      name = 'nobody'
      perms({ allow: ['login'], deny: null })
      cb(null, { okay: true, user: name })
    },
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
      return pull.values(
        Object.keys(store).map(function (k) {
          return { key: k, value: store[k] }
        })
      )
    }
  }

  session.nested = session

  return mux(null, api, id)(session, perms)
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
        t.ok(err); cb()
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
    client.login({ name: 'user', pass: 'password' }, function (err, res) {
      if (err) throw err
      t.ok(res.okay)
      if (process.env.TEST_VERBOSE) console.log(res)
      t.equal(res.name, 'user')

      cont.para([
        function (cb) {
          client.get('foo', function (err, value) {
            if (err) throw err
            t.equal(value, 1)
            cb()
          })
        },
        function (cb) {
          client.put('foo', -1, function (err) {
            t.ok(err); cb()
          })
        },
        function (cb) {
          client.del('foo', function (err) {
            t.ok(err); cb()
          })
        },
        function (cb) {
          pull(client.read(), pull.collect(function (err, ary) {
            if (err) throw err
            t.deepEqual(ary, [
              { key: 'foo', value: 1 },
              { key: 'bar', value: 2 },
              { key: 'baz', value: 3 }
            ]); cb()
          }))
        }
      ])(function () {
        t.end()
      })
    })
  })
})

tape('multiple sessions at once', function (t) {
  const server1 = createServerAPI(store)
  const server2 = createServerAPI(store)
  const admin = createClientAPI()
  const user = createClientAPI()

  const s1s = server1.createStream()
  const s2s = server2.createStream()
  const us = user.createStream()
  const as = admin.createStream()

  pull(us, s1s, us)
  pull(as, s2s, as)

  cont.para([
    function (cb) {
      user.login({ name: 'user', pass: 'password' }, cb)
    },
    function (cb) {
      admin.login({ name: 'admin', pass: 'admin' }, cb)
    }
  ])(function (err) {
    if (err) throw err

    user.get('foo', function (err, value) {
      if (err) throw err
      t.equal(value, 1)
      admin.put('foo', 2, function (err) {
        if (err) throw err
        user.get('foo', function (err, value) {
          if (err) throw err
          t.equal(value, 2)
          t.end()
        })
      })
    })
  })
})

tape('nested sessions', function (t) {
  const server = createServerAPI(store)
  const client = createClientAPI()

  const ss = server.createStream()
  const cs = client.createStream()

  pull(cs, ss, cs)

  cont.para([
    function (cb) {
      client.nested.get('foo', function (err) {
        t.ok(err); cb()
      })
    },
    function (cb) {
      client.nested.put('foo', function (err) {
        t.ok(err); cb()
      })
    },
    function (cb) {
      client.nested.del('foo', function (err) {
        t.ok(err); cb()
      })
    },
    function (cb) {
      pull(client.nested.read(), pull.collect(function (err) {
        t.ok(err); cb()
      }))
    }
  ])(function () {
    client.login({ name: 'nested', pass: 'foofoo' }, function () {
      cont.para([
        function (cb) {
          client.nested.get('foo', function (err, value) {
            if (err) throw err
            t.equal(value, 2, 'foo should be 2')
            cb()
          })
        },
        function (cb) {
          client.nested.put('foo', -1, function (err) {
            t.ok(err); cb()
          })
        },
        function (cb) {
          client.nested.del('foo', function (err) {
            t.ok(err); cb()
          })
        },
        function (cb) {
          pull(client.nested.read(), pull.collect(function (err, ary) {
            if (err) throw err
            t.deepEqual(ary, [
              { key: 'foo', value: 2 },
              { key: 'bar', value: 2 },
              { key: 'baz', value: 3 }
            ]); cb()
          }))
        }
      ])(function () {
        t.end()
      })
    })
  })
})
