

var tape = require('tape')
var mux = require('../')
var pull = require('pull-stream')
var pair = require('pull-pair')

function createClient (t) {

  var client = {
    get   : 'async',
    read  : 'source',
    write : 'sink',
    echo  : 'duplex'
  }

  var A = mux(client, null) ()

  var B = mux(null, {}) ({
    get: function (a, cb) {
      //root access!! this should never happen!
      t.ok(false, 'attacker got in')
      cb(null, "ACCESS GRANTED")
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

  var s = A.createStream()
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

  //create a client with a different manifest to the server.
  //create a server that

  const A = createClient(t)

  A.get('foo', function (err, val) {
    t.ok(err)
    t.notEqual(val, "ACCESS GRANTED")
    t.end()
  })

})

tape('sink which is not public', function (t) {

  //create a client with a different manifest to the server.
  var A = createClient(t)

  pull(
    pull.values(["ACCESS", "GRANTED"]),
    A.write(null, function (err) {
      t.ok(err)
      t.end()
    })
  )
})

tape('source which is not public', function (t) {

  //create a client with a different manifest to the server.
  var A = createClient(t)

  pull(
    A.read(),
    pull.collect(function (err, ary) {
      t.ok(err)
      t.notDeepEqual(ary, ["ACCESS", "GRANTED"])
      t.end()
    })
  )
})

tape('duplex which is not public', function (t) {

  //create a client with a different manifest to the server.
  var A = createClient(t)

  pull(
    A.read(),
    pull.collect(function (err, ary) {
      t.ok(err)
      t.notDeepEqual(ary, ["ACCESS", "GRANTED"])
      t.end()
    })
  )
})

tape('client and server manifest have different types', function (t) {
  var clientM = { foo: 'async' }
  var serverM = { foo: 'source' }

  var A = mux(clientM, null) ()
  var B = mux(null, serverM) ()

  var as = A.createStream()
  pull(as, B.createStream(), as)

  A.foo(function (err) {
    if (process.env.TEST_VERBOSE) console.log(err)
    t.ok(err)
    t.end()
  })
})
