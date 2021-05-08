
const tape = require('tape')
const mux = require('../')
const pull = require('pull-stream')
const pair = require('pull-pair')

function createClient (t) {
  const client = {
    get: 'async',
    read: 'source',
    write: 'sink',
    echo: 'duplex'
  }

  const A = mux(client, null)()

  const B = mux(null, {})({
    get: function (a, cb) {
      // root access!! this should never happen!
      t.ok(false, 'attacker got in')
      cb(null, 'ACCESS GRANTED')
    },
    read: function () {
      t.ok(false, 'attacker got in')
      return pull.values(['ACCESS', 'GRANTED'])
    },
    write: function () {
      t.ok(false, 'attacker got in')
      return pull.drain()
    },
    echo: function () {
      t.ok(false, 'attacker got in')
      return pair()
    }
  })

  const s = A.createStream()
  pull(
    s,
    process.env.TEST_VERBOSE ? pull.through(console.log) : null,
    B.createStream(),
    process.env.TEST_VERBOSE ? pull.through(console.log) : null,
    s
  )

  return A
}

tape('request which is not public', function (t) {
  // create a client with a different manifest to the server.
  // create a server that

  const A = createClient(t)

  A.get('foo', function (err, val) {
    t.ok(err)
    t.notEqual(val, 'ACCESS GRANTED')
    t.end()
  })
})

tape('sink which is not public', function (t) {
  // create a client with a different manifest to the server.
  const A = createClient(t)

  pull(
    pull.values(['ACCESS', 'GRANTED']),
    A.write(null, function (err) {
      t.ok(err)
      t.end()
    })
  )
})

tape('source which is not public', function (t) {
  // create a client with a different manifest to the server.
  const A = createClient(t)

  pull(
    A.read(),
    pull.collect(function (err, ary) {
      t.ok(err)
      t.notDeepEqual(ary, ['ACCESS', 'GRANTED'])
      t.end()
    })
  )
})

tape('duplex which is not public', function (t) {
  // create a client with a different manifest to the server.
  const A = createClient(t)

  pull(
    A.read(),
    pull.collect(function (err, ary) {
      t.ok(err)
      t.notDeepEqual(ary, ['ACCESS', 'GRANTED'])
      t.end()
    })
  )
})

tape('client and server manifest have different types', function (t) {
  const clientM = { foo: 'async' }
  const serverM = { foo: 'source' }

  const A = mux(clientM, null)()
  const B = mux(null, serverM)()

  const as = A.createStream()
  pull(as, B.createStream(), as)

  A.foo(function (err) {
    if (process.env.TEST_VERBOSE) console.log(err)
    t.ok(err)
    t.end()
  })
})
