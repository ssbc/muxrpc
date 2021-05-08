const tape = require('tape')
const pull = require('pull-stream')
const pushable = require('pull-pushable')
const mux = require('../')

module.exports = function (serializer, buffers) {
  const b = buffers
    ? function (b) {
        return (
          Buffer.isBuffer(b)
          // reserialize, to take into the account
          // changes Buffer#toJSON between 0.10 and 0.12
            ? JSON.parse(JSON.stringify(b))
            : b
        )
      }
    : function (b) { return b }

  const client = {
    hello: 'async',
    goodbye: 'async',
    stuff: 'source',
    bstuff: 'source',
    things: 'sink',
    suchstreamwow: 'duplex'
  }

  tape('async', function (t) {
    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      hello: function (a, cb) {
        cb(null, 'hello, ' + a)
      },
      goodbye: function (b, cb) {
        cb(null, b)
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

    A.hello('world', function (err, value) {
      if (err) throw err
      if (process.env.TEST_VERBOSE) console.log(value)
      t.equal(value, 'hello, world')

      const buf = Buffer.from([0, 1, 2, 3, 4])
      A.goodbye(buf, function (err, buf2) {
        if (err) throw err
        if (process.env.TEST_VERBOSE) console.log(b(buf2), b(buf))
        t.deepEqual(b(buf2), b(buf))
        t.end()
      })
    })
  })

  tape('async promise', function (t) {
    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      hello: function (a, cb) {
        cb(null, 'hello, ' + a)
      },
      goodbye: function (b, cb) {
        cb(null, b)
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

    A.hello('world').then((value) => {
      if (process.env.TEST_VERBOSE) console.log(value)
      t.equal(value, 'hello, world')

      const buf = Buffer.from([0, 1, 2, 3, 4])
      A.goodbye(buf).then((buf2) => {
        if (process.env.TEST_VERBOSE) console.log(b(buf2), b(buf))
        t.deepEqual(b(buf2), b(buf))
        t.end()
      })
    })
  })

  tape('source', function (t) {
    const expected = [
      Buffer.from([0, 1]),
      Buffer.from([2, 3]),
      Buffer.from([4, 5])
    ]

    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      stuff: function (b) {
        return pull.values([1, 2, 3, 4, 5].map(function (a) {
          return a * b
        }))
      },
      bstuff: function () {
        return pull.values(expected)
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

    pull(A.stuff(5), pull.collect(function (err, ary) {
      if (err) throw err
      if (process.env.TEST_VERBOSE) console.log(ary)
      t.deepEqual(ary, [5, 10, 15, 20, 25])

      pull(A.bstuff(), pull.collect(function (err, ary) {
        if (err) throw err
        if (process.env.TEST_VERBOSE) console.log(ary.map(b), expected.map(b))
        t.deepEqual(ary.map(b), expected.map(b))
        t.end()
      }))
    }))
  })

  tape('sync', function (t) {
    const client = {
      syncOk: 'sync',
      syncErr: 'sync'
    }

    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      syncOk: function (a) {
        return { okay: a }
      },
      syncErr: function (b) {
        throw new Error('test error:' + b)
      }
    })

    const s = A.createStream()
    pull(s, B.createStream(), s)

    A.syncOk(true, function (err, value) {
      t.error(err)
      t.deepEqual(value, { okay: true })
      A.syncErr('blah', function (err) {
        t.equal(err.message, 'test error:blah')
        t.end()
      })
    })
  })

  tape('sink', function (t) {
    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      things: function (someParam) {
        return pull.collect(function (err, values) {
          if (err) throw err
          t.equal(someParam, 5)
          t.deepEqual(values, [1, 2, 3, 4, 5])
          t.end()
        })
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
    pull(pull.values([1, 2, 3, 4, 5]), A.things(5))
  })

  tape('duplex', function (t) {
    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      suchstreamwow: function (someParam) {
        // did the param come through?
        t.equal(someParam, 5)

        // normally, we'd use pull.values and pull.collect
        // however, pull.values sends 'end' onto the stream, which closes the muxrpc stream immediately
        // ...and we need the stream to stay open for the drain to collect
        let nextValue = 0
        const p = pushable()
        for (let i = 0; i < 5; i++) { p.push(i) }
        return {
          source: p,
          sink: pull.drain(function (value) {
            if (process.env.TEST_VERBOSE) console.log('************', nextValue, value)
            t.equal(nextValue, value)
            nextValue++
            if (nextValue === 5) {
              t.end()
            }
          })
        }
      }
    })

    const s = A.createStream()
    pull(
      s,
      process.env.TEST_VERBOSE ? pull.through(console.log.bind(console, 'IN')) : null,
      B.createStream(),
      process.env.TEST_VERBOSE ? pull.through(console.log.bind(console, 'OUT')) : null,
      s
    )
    const dup = A.suchstreamwow(5)
    pull(dup, dup)
  })

  tape('async - error1', function (t) {
    const A = mux(client, null)()

    const s = A.createStream()

    A.hello('world', function (err) {
      t.ok(err)
      t.end()
    })

    s.sink(function (abort, cb) {
      const errEnd = true
      cb(errEnd)
    })
  })

  tape('async - error2', function (t) {
    const A = mux(client, null)()

    const s = A.createStream()

    A.hello('world', function (err) {
      if (process.env.TEST_VERBOSE) console.log('CB!')
      t.ok(err)
      t.end()
    })

    s.source(true, function () {})
  })

  tape('buffer calls before stream is created', function (t) {
    const A = mux(client, null)()
    const B = mux(null, client)({
      hello: function (a, cb) {
        cb(null, 'hello, ' + a)
      }
    })

    A.hello('world', function (err, value) {
      if (err) throw err
      if (process.env.TEST_VERBOSE) console.log(value)
      t.equal(value, 'hello, world')
      t.end()
    })

    const s = A.createStream()
    pull(s, B.createStream(), s)
  })

  //  tape('async - error, and reconnect', function (t) {
  //    var A = mux(client, null) ()
  //
  //    var s = A.createStream()
  //
  //    A.hello('world', function (err, value) {
  //      t.ok(err)
  //
  //      var B = mux(null, client) ({
  //        hello: function (a, cb) {
  //          cb(null, 'hello, '+a)
  //        },
  //      })
  //
  //      var s = A.createStream()
  //
  //      pull(s, B.createStream(), s)
  //
  //      A.hello('world', function (err, value) {
  //        t.notOk(err)
  //        t.equal(value, 'hello, world')
  //        t.end()
  //      })
  //    })
  //
  //    s.sink(function (abort, cb) { cb(true) })
  //  })

  tape('recover error written to outer stream', function (t) {
    const A = mux(client, null)()
    const err = new Error('testing errors')
    const s = A.createStream(function (_err) {
      t.equal(_err, err)
      t.end()
    })

    pull(pull.error(err), s.sink)
  })

  tape('recover error when outer stream aborted', function (t) {
    const A = mux(client, null)()
    const err = new Error('testing errors')
    const s = A.createStream(function (_err) {
      t.equal(_err, err)
      t.end()
    })

    s.source(err, function () {})
  })

  tape('cb when stream is ended', function (t) {
    const A = mux(client, null)()
    const s = A.createStream(function (err) {
      //      if(err) throw err
      t.ok(err)
      //      t.equal(err, null)
      t.end()
    })

    pull(pull.empty(), s.sink)
  })

  tape('cb when stream is aborted', function (t) {
    const err = new Error('testing error')
    const A = mux(client, null)()
    const s = A.createStream(function (_err) {
      //    if(_err) throw err
      t.equal(_err, err)
      //      t.ok(err)
      t.end()
    })

    s.source(err, function () {})
  })

  const client2 = {
    salutations: {
      hello: 'async',
      goodbye: 'async'
    }
  }

  tape('nested methods', function (t) {
    const A = mux(client2, null, serializer)()
    const B = mux(null, client2, serializer)({
      salutations: {
        hello: function (a, cb) {
          cb(null, 'hello, ' + a)
        },
        goodbye: function (b, cb) {
          cb(null, b)
        }
      }
    })

    const s = A.createStream()
    pull(
      s,
      process.env.TEST_VERBOSE ? pull.through(console.log.bind(console, 'IN')) : null,
      B.createStream(),
      process.env.TEST_VERBOSE ? pull.through(console.log.bind(console, 'OUT')) : null,
      s
    )

    A.salutations.hello('world', function (err, value) {
      if (err) throw err
      if (process.env.TEST_VERBOSE) console.log(value)
      t.equal(value, 'hello, world')

      const buf = Buffer.from([0, 1, 2, 3, 4])
      A.salutations.goodbye(buf, function (err, buf2) {
        if (err) throw err
        t.deepEqual(b(buf2), b(buf))
        t.end()
      })
    })
  })

  tape('sink', function (t) {
    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      things: function (len) {
        return pull.collect(function (err, ary) {
          t.error(err)
          t.equal(ary.length, len)
        })
      }
    })

    const s = A.createStream(); pull(s, B.createStream(), s)

    pull(pull.values([1, 2, 3]), A.things(3, function (err) {
      if (err) throw err
      t.end()
    }))
  })

  tape('sink - abort', function (t) {
    const err = new Error('test abort error')

    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      things: function () {
        return function (read) {
          read(err, function () {})
        }
      }
    })

    const s = A.createStream(); pull(s, B.createStream(), s)

    pull(pull.values([1, 2, 3]), A.things(3, function (_err) {
      t.ok(_err)
      t.equal(_err.message, err.message)
      t.end()
    }))
  })
}

// see ./jsonb.js for tests with serialization.
if (!module.parent) { module.exports(function (e) { return e }) }
