const tape = require('tape')
const pull = require('pull-stream')
const Pushable = require('pull-pushable')
const mux = require('../')

module.exports = function (serializer) {
  const client = {
    hello: 'async',
    goodbye: 'async',
    stuff: 'source',
    bstuff: 'source',
    things: 'sink',
    suchstreamwow: 'duplex'
  }

  tape('async handle closed gracefully', (t) => {
    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      hello (a, cb) {
        cb(null, 'hello, ' + a)
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

      A.close((err) => {
        if (err) throw err
        A.hello('world', (err) => {
          if (process.env.TEST_VERBOSE) console.log(err)
          t.ok(err)
          t.end()
        })
      })
    })
  })

  tape('source handle closed gracefully', (t) => {
    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      stuff (b) {
        return pull.values([1, 2, 3, 4, 5].map((a) => a * b))
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

      A.close((err) => {
        if (err) throw err
        pull(A.stuff(5), pull.collect((err) => {
          t.ok(err)
          if (process.env.TEST_VERBOSE) console.log(err)
          t.end()
        }))
      })
    }))
  })

  tape('sink handle closed gracefully', (t) => {
    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      things () {
        throw new Error('should not be called')
      }
    }, null, serializer)

    pull(
      A.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log) : null,
      B.stream,
      process.env.TEST_VERBOSE ? pull.through(console.log) : null,
      A.stream
    )
    A.close((err) => {
      if (err) throw err
      pull(pull.values([1, 2, 3, 4, 5]), A.things(5))

      // sinks are hard to test
      // once closed, the sink (A.things) just aborts early
      // the creator of the sink (this block) has no cb after that abort
      // so we'll just make sure 100ms passes without anything exploding

      setTimeout(() => {
        t.end()
      }, 100)
    })
  })

  tape('close twice', (t) => {
    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      hello (a, cb) {
        cb(null, 'hello, ' + a)
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

      A.close((err) => {
        if (err) throw err

        A.close((err) => {
          if (err) throw err
          t.end()
        })
      })
    })
  })

  tape('wait for streams to end before closing', (t) => {
    const pushable = Pushable()
    let closed = false; let n = 2; const drained = []

    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      stuff () { return pushable }
    }, null, serializer)

    pull(A.stream, B.stream, A.stream)

    pull(
      A.stuff(),
      pull.drain((data) => {
        drained.push(data)
        t.notOk(closed)
      }, () => {
        next()
      })
    )

    B.close(() => {
      closed = true
      next()
    })

    function next () {
      if (--n) return
      t.deepEqual(drained, [1, 2, 3])
      t.end()
    }

    pushable.push(1)
    setTimeout(() => {
      // this should have already gotten through,
      // but should not have closed yet.
      t.deepEqual(drained, [1])
      pushable.push(2)
      setTimeout(() => {
        t.deepEqual(drained, [1, 2])
        pushable.push(3)
        setTimeout(() => {
          t.deepEqual(drained, [1, 2, 3])
          pushable.end()
        })
      })
    })
  })

  tape('destroy streams when close(immediate, cb) is used', (t) => {
    let closed = false; let n = 3; const drained = []

    const pushable = Pushable(() => {
      next()
    })
    const A = mux(client, null, null, null, serializer)
    const B = mux(null, client, {
      stuff () { return pushable }
    }, null, serializer)

    pull(A.stream, B.stream, A.stream)

    pull(
      A.stuff(),
      pull.drain((data) => {
        drained.push(data)
        t.notOk(closed)
      }, (err) => {
        t.ok(err)
        next()
      })
    )

    function next () {
      if (--n) return
      t.deepEqual(drained, [1])
      t.end()
    }

    pushable.push(1)
    setTimeout(() => {
      // this should have already gotten through,
      // but should not have closed yet.
      t.deepEqual(drained, [1])
      B.close(true, () => {
        closed = true
        next()
      })

      pushable.push(2)
    })
  })
}

if (!module.parent) { module.exports() }
