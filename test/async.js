const tape = require('tape')
const pull = require('pull-stream')
const pushable = require('pull-pushable')
const mux = require('../')

const id = (e) => e

module.exports = function (serializer, buffers) {
  const b = buffers
    ? (b) => (
        Buffer.isBuffer(b)
        // reserialize, to take into the account
        // changes Buffer#toJSON between 0.10 and 0.12
          ? JSON.parse(JSON.stringify(b))
          : b
      )
    : (b) => b

  const client = {
    hello: 'async',
    goodbye: 'async',
    stuff: 'source',
    bstuff: 'source',
    things: 'sink',
    suchstreamwow: 'duplex'
  }

  tape('async', (t) => {
    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      hello (a, cb) {
        cb(null, 'hello, ' + a)
      },
      goodbye (b, cb) {
        cb(null, b)
      }
    }, null, serializer)

    pull(
      A.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log) : null,
      B.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log) : null,
      A.stream
    )

    A.hello('world', (err, value) => {
      if (err) throw err
      if (process.env.TEST_VERBOSE) console.log(value)
      t.equal(value, 'hello, world')

      const buf = Buffer.from([0, 1, 2, 3, 4])
      A.goodbye(buf, (err, buf2) => {
        if (err) throw err
        if (process.env.TEST_VERBOSE) console.log(b(buf2), b(buf))
        t.deepEqual(b(buf2), b(buf))
        t.end()
      })
    })
  })

  tape('async promise', (t) => {
    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      hello (a, cb) {
        cb(null, 'hello, ' + a)
      },
      goodbye (b, cb) {
        cb(null, b)
      }
    }, null, serializer)

    pull(
      A.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log) : null,
      B.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log) : null,
      A.stream
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

  tape('source', (t) => {
    const expected = [
      Buffer.from([0, 1]),
      Buffer.from([2, 3]),
      Buffer.from([4, 5])
    ]

    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      stuff (b) {
        return pull.values([1, 2, 3, 4, 5].map((a) => a * b))
      },
      bstuff () {
        return pull.values(expected)
      }
    }, null, serializer)

    pull(
      A.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log) : null,
      B.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log) : null,
      A.stream
    )

    pull(A.stuff(5), pull.collect((err, ary) => {
      if (err) throw err
      if (process.env.TEST_VERBOSE) console.log(ary)
      t.deepEqual(ary, [5, 10, 15, 20, 25])

      pull(A.bstuff(), pull.collect((err, ary) => {
        if (err) throw err
        if (process.env.TEST_VERBOSE) console.log(ary.map(b), expected.map(b))
        t.deepEqual(ary.map(b), expected.map(b))
        t.end()
      }))
    }))
  })

  tape('sync', (t) => {
    const client = {
      syncOk: 'sync',
      syncErr: 'sync'
    }

    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      syncOk (a) {
        return { okay: a }
      },
      syncErr (b) {
        throw new Error('test error:' + b)
      }
    }, null, serializer)

    pull(A.stream, B.stream, A.stream)

    A.syncOk(true, (err, value) => {
      t.error(err)
      t.deepEqual(value, { okay: true })
      A.syncErr('blah', (err) => {
        t.equal(err.message, 'test error:blah')
        t.end()
      })
    })
  })

  tape('sink', (t) => {
    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      things (someParam) {
        return pull.collect((err, values) => {
          if (err) throw err
          t.equal(someParam, 5)
          t.deepEqual(values, [1, 2, 3, 4, 5])
          t.end()
        })
      }
    }, null, serializer)

    pull(
      A.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log) : null,
      B.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log) : null,
      A.stream
    )
    pull(pull.values([1, 2, 3, 4, 5]), A.things(5))
  })

  tape('duplex', (t) => {
    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      suchstreamwow (someParam) {
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
          sink: pull.drain((value) => {
            if (process.env.TEST_VERBOSE) console.log('************', nextValue, value)
            t.equal(nextValue, value)
            nextValue++
            if (nextValue === 5) {
              t.end()
            }
          })
        }
      }
    }, null, serializer)

    pull(
      A.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log.bind(console, 'IN')) : null,
      B.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log.bind(console, 'OUT')) : null,
      A.stream
    )
    const dup = A.suchstreamwow(5)
    pull(dup, dup)
  })

  tape('async - error1', (t) => {
    const A = mux(client, null)

    const s = A.stream

    A.hello('world', (err) => {
      t.ok(err)
      t.end()
    })

    s.sink((abort, cb) => {
      const errEnd = true
      cb(errEnd)
    })
  })

  tape('async - error2', (t) => {
    const A = mux(client, null)

    const s = A.stream

    A.hello('world', (err) => {
      if (process.env.TEST_VERBOSE) console.log('CB!')
      t.ok(err)
      t.end()
    })

    s.source(true, () => {})
  })

  tape('buffer calls before stream is created', (t) => {
    const A = mux(client, null)
    const B = mux(null, client, {
      hello (a, cb) {
        cb(null, 'hello, ' + a)
      }
    })

    A.hello('world', (err, value) => {
      if (err) throw err
      if (process.env.TEST_VERBOSE) console.log(value)
      t.equal(value, 'hello, world')
      t.end()
    })

    pull(A.stream, B.stream, A.stream)
  })

  //  tape('async - error, and reconnect', (t) => {
  //    var A = mux(client, null)
  //
  //    var s = A.stream
  //
  //    A.hello('world', (err, value) => {
  //      t.ok(err)
  //
  //      var B = mux(null, client) ({
  //        hello (a, cb) {
  //          cb(null, 'hello, '+a)
  //        },
  //      })
  //
  //      var s = A.stream
  //
  //      pull(s, B.stream, s)
  //
  //      A.hello('world', (err, value) => {
  //        t.notOk(err)
  //        t.equal(value, 'hello, world')
  //        t.end()
  //      })
  //    })
  //
  //    s.sink((abort, cb) => { cb(true) })
  //  })

  const client2 = {
    salutations: {
      hello: 'async',
      goodbye: 'async'
    }
  }

  tape('nested methods', (t) => {
    const A = mux(client2, null, null, null, serializer)
    const B = mux(null, client2, {
      salutations: {
        hello (a, cb) {
          cb(null, 'hello, ' + a)
        },
        goodbye (b, cb) {
          cb(null, b)
        }
      }
    }, null, serializer)

    pull(
      A.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log.bind(console, 'IN')) : null,
      B.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log.bind(console, 'OUT')) : null,
      A.stream
    )

    A.salutations.hello('world', (err, value) => {
      if (err) throw err
      if (process.env.TEST_VERBOSE) console.log(value)
      t.equal(value, 'hello, world')

      const buf = Buffer.from([0, 1, 2, 3, 4])
      A.salutations.goodbye(buf, (err, buf2) => {
        if (err) throw err
        t.deepEqual(b(buf2), b(buf))
        t.end()
      })
    })
  })

  tape('sink', (t) => {
    const A = mux(client, null, serializer)
    const B = mux(null, client, {
      things (len) {
        return pull.collect((err, ary) => {
          t.error(err)
          t.equal(ary.length, len)
        })
      }
    }, null, serializer)

    pull(A.stream, B.stream, A.stream)

    pull(pull.values([1, 2, 3]), A.things(3, (err) => {
      if (err) throw err
      t.end()
    }))
  })

  tape('sink - abort', (t) => {
    const err = new Error('test abort error')

    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      things () {
        return (read) => {
          read(err, () => {})
        }
      }
    }, null, serializer)

    pull(A.stream, B.stream, A.stream)

    pull(pull.values([1, 2, 3]), A.things(3, (_err) => {
      t.ok(_err)
      t.equal(_err.message, err.message)
      t.end()
    }))
  })
}

// see ./jsonb.js for tests with serialization.
if (!module.parent) { module.exports(id) }
