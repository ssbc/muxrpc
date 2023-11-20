const tape = require('tape')
const pull = require('pull-stream')
const cont = require('cont')
const mux = require('../')
const Permissions = require('../permissions')

const manifest = {
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

const store = {
  foo: 1,
  bar: 2,
  baz: 3
}

function createServerAPI (store) {
  let name = 'nobody'

  // this wraps a session.

  const perms = Permissions({ allow: ['login'] })

  const local = {
    // implement your own auth function.
    // it should just set the allow and deny lists.

    login (opts, cb) {
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
    logout (cb) {
      name = 'nobody'
      perms({ allow: ['login'], deny: null })
      cb(null, { okay: true, user: name })
    },
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
      return pull.values(
        Object.keys(store).map((k) => {
          return { key: k, value: store[k] }
        })
      )
    }
  }

  local.nested = local

  return mux(null, manifest, local, perms)
}

function createClientAPI () {
  return mux(manifest, null)
}

tape('secure rpc', (t) => {
  const server = createServerAPI(store)
  const client = createClientAPI()

  pull(client.stream, server.stream, client.stream)

  cont.para([
    (cb) => {
      client.get('foo', (err) => {
        t.ok(err); cb()
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
  ])(function () {
    client.login({ name: 'user', pass: 'password' }, (err, res) => {
      if (err) throw err
      t.ok(res.okay)
      if (process.env.TEST_VERBOSE) console.log(res)
      t.equal(res.name, 'user')

      cont.para([
        (cb) => {
          client.get('foo', (err, value) => {
            if (err) throw err
            t.equal(value, 1)
            cb()
          })
        },
        (cb) => {
          client.put('foo', -1, (err) => {
            t.ok(err); cb()
          })
        },
        (cb) => {
          client.del('foo', (err) => {
            t.ok(err); cb()
          })
        },
        (cb) => {
          pull(client.read(), pull.collect((err, ary) => {
            if (err) throw err
            t.deepEqual(ary, [
              { key: 'foo', value: 1 },
              { key: 'bar', value: 2 },
              { key: 'baz', value: 3 }
            ]); cb()
          }))
        }
      ])(() => {
        t.end()
      })
    })
  })
})

tape('multiple sessions at once', (t) => {
  const server1 = createServerAPI(store)
  const server2 = createServerAPI(store)
  const admin = createClientAPI()
  const user = createClientAPI()

  const s1s = server1.stream
  const s2s = server2.stream
  const us = user.stream
  const as = admin.stream

  pull(us, s1s, us)
  pull(as, s2s, as)

  cont.para([
    (cb) => {
      user.login({ name: 'user', pass: 'password' }, cb)
    },
    (cb) => {
      admin.login({ name: 'admin', pass: 'admin' }, cb)
    }
  ])(function (err) {
    if (err) throw err

    user.get('foo', (err, value) => {
      if (err) throw err
      t.equal(value, 1)
      admin.put('foo', 2, (err) => {
        if (err) throw err
        user.get('foo', (err, value) => {
          if (err) throw err
          t.equal(value, 2)
          t.end()
        })
      })
    })
  })
})

tape('nested sessions', (t) => {
  const server = createServerAPI(store)
  const client = createClientAPI()

  const ss = server.stream
  const cs = client.stream

  pull(cs, ss, cs)

  cont.para([
    (cb) => {
      client.nested.get('foo', (err) => {
        t.ok(err); cb()
      })
    },
    (cb) => {
      client.nested.put('foo', (err) => {
        t.ok(err); cb()
      })
    },
    (cb) => {
      client.nested.del('foo', (err) => {
        t.ok(err); cb()
      })
    },
    (cb) => {
      pull(client.nested.read(), pull.collect((err) => {
        t.ok(err)
        cb()
      }))
    }
  ])(function () {
    client.login({ name: 'nested', pass: 'foofoo' }, () => {
      cont.para([
        (cb) => {
          client.nested.get('foo', (err, value) => {
            if (err) throw err
            t.equal(value, 2, 'foo should be 2')
            cb()
          })
        },
        (cb) => {
          client.nested.put('foo', -1, (err) => {
            t.ok(err); cb()
          })
        },
        (cb) => {
          client.nested.del('foo', (err) => {
            t.ok(err); cb()
          })
        },
        (cb) => {
          pull(client.nested.read(), pull.collect((err, ary) => {
            if (err) throw err
            t.deepEqual(ary, [
              { key: 'foo', value: 2 },
              { key: 'bar', value: 2 },
              { key: 'baz', value: 3 }
            ]); cb()
          }))
        }
      ])(() => {
        t.end()
      })
    })
  })
})
