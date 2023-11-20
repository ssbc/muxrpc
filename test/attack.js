const tape = require('tape')
const pull = require('pull-stream')
const pair = require('pull-pair')
const mux = require('../')

function createClient (t) {
  const client = {
    get: 'async',
    read: 'source',
    write: 'sink',
    echo: 'duplex'
  }

  const A = mux(client, null)

  const B = mux(null, {}, {
    get (a, cb) {
      // root access!! this should never happen!
      t.ok(false, 'attacker got in')
      cb(null, 'ACCESS GRANTED')
    },
    read () {
      t.ok(false, 'attacker got in')
      return pull.values(['ACCESS', 'GRANTED'])
    },
    write () {
      t.ok(false, 'attacker got in')
      return pull.drain()
    },
    echo () {
      t.ok(false, 'attacker got in')
      return pair()
    }
  })

  pull(
    A.stream,
    process.env.TEST_VERBOSE ? pull.through(console.log) : null,
    B.stream,
    process.env.TEST_VERBOSE ? pull.through(console.log) : null,
    A.stream
  )

  return A
}

tape('request which is not public', (t) => {
  // create a client with a different manifest to the server.
  // create a server that

  const A = createClient(t)

  A.get('foo', (err, val) => {
    t.ok(err)
    t.notEqual(val, 'ACCESS GRANTED')
    t.end()
  })
})

tape('sink which is not public', (t) => {
  // create a client with a different manifest to the server.
  const A = createClient(t)

  pull(
    pull.values(['ACCESS', 'GRANTED']),
    A.write(null, (err) => {
      t.ok(err)
      t.end()
    })
  )
})

tape('source which is not public', (t) => {
  // create a client with a different manifest to the server.
  const A = createClient(t)

  pull(
    A.read(),
    pull.collect((err, ary) => {
      t.ok(err)
      t.notDeepEqual(ary, ['ACCESS', 'GRANTED'])
      t.end()
    })
  )
})

tape('duplex which is not public', (t) => {
  // create a client with a different manifest to the server.
  const A = createClient(t)

  pull(
    A.read(),
    pull.collect((err, ary) => {
      t.ok(err)
      t.notDeepEqual(ary, ['ACCESS', 'GRANTED'])
      t.end()
    })
  )
})

tape('client and server manifest have different types', (t) => {
  const clientM = { foo: 'async' }
  const serverM = { foo: 'source' }

  const A = mux(clientM, null)
  const B = mux(null, serverM)

  pull(A.stream, B.stream, A.stream)

  A.foo((err) => {
    if (process.env.TEST_VERBOSE) console.log(err)
    t.ok(err)
    t.end()
  })
})
