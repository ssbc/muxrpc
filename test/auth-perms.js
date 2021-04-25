var tape = require('tape')
var pull = require('pull-stream')
var mux = require('../')
var cont = require('cont')
var Permissions = require('../permissions')

var api = {
  login  : 'async',
  logout : 'async',
  get    : 'async',
  put    : 'async',
  del    : 'async',
  read   : 'source',
  nested: {
    get    : 'async',
    put    : 'async',
    del    : 'async',
    read   : 'source'
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

  var perms = Permissions({allow: ['login']})

  var session = {
    //implement your own auth function.
    //it should just set the allow and deny lists.

    login: function (opts, cb) {
      //allow read operations
      if(opts.name === 'user' && opts.pass === "password")
        perms({deny: ['put', 'del'], allow: null})

      //allow write operations
      else if(opts.name === 'admin' && opts.pass === "admin") //whatelse?
        perms({deny: null, allow: null}) //allow everything

      //
      else if(opts.name === 'nested' && opts.pass === 'foofoo')
        perms({
          //read only access to nested methods
          allow: ['nested'],
          deny: [['nested', 'put'], ['nested', 'del']]
        })

      //you are nobody!
      else
        return cb(new Error('not authorized'))

      name = opts.name

      cb(null, {okay: true, name: name})
    },
    logout: function (cb) {
      name = 'nobody'
      perms({allow: ['login'], deny: null})
      cb(null, {okay: true, user: name})
    },
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
      return pull.values(
        Object.keys(store).map(function (k) {
          return {key: k, value: store[k]}
        })
      )
    }
  }

  session.nested = session

  return mux(null, api, id)(session, perms)
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
    client.login({name: 'user', pass: 'password'}, function (err, res) {
      if(err) throw err
      t.ok(res.okay)
      if (process.env.TEST_VERBOSE) console.log(res)
      t.equal(res.name, 'user')

      cont.para([
        function (cb) {
          client.get('foo', function (err, value) {
            if(err) throw err
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
            if(err) throw err
            t.deepEqual(ary, [
              {key: 'foo', value: 1},
              {key: 'bar', value: 2},
              {key: 'baz', value: 3},
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

  var server1 = createServerAPI(store)
  var server2 = createServerAPI(store)
  var admin   = createClientAPI()
  var user    = createClientAPI()

  var s1s = server1.createStream()
  var s2s = server2.createStream()
  var us = user.createStream()
  var as = admin.createStream()

  pull(us, s1s, us)
  pull(as, s2s, as)

  cont.para([
    function (cb) {
      user.login({name: 'user', pass: 'password'}, cb)
    },
    function (cb) {
      admin.login({name: 'admin', pass: 'admin'}, cb)
    }
  ])(function (err) {
    if(err) throw err

    user.get('foo', function (err, value) {
      if(err) throw err
      t.equal(value, 1)
      admin.put('foo', 2, function (err) {
        if(err) throw err
        user.get('foo', function (err, value) {
          if(err) throw err
          t.equal(value, 2)
          t.end()
        })
      })
    })

  })

})

tape('nested sessions', function (t) {
  var server = createServerAPI(store)
  var client = createClientAPI()

  var ss = server.createStream()
  var cs = client.createStream()

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
    client.login({name: 'nested', pass: 'foofoo'}, function () {
      cont.para([
        function (cb) {
          client.nested.get('foo', function (err, value) {
            if(err) throw err
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
            if(err) throw err
            t.deepEqual(ary, [
              {key: 'foo', value: 2},
              {key: 'bar', value: 2},
              {key: 'baz', value: 3},
            ]); cb()
          }))
        }
      ])(function () {

          t.end()
        })
    })
  })

})
