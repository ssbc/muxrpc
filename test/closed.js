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

  tape('async handle closed gracefully', function (t) {
    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      hello: function (a, cb) {
        cb(null, 'hello, ' + a)
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

      A.close(function (err) {
        if (err) throw err
        A.hello('world', function (err) {
          if (process.env.TEST_VERBOSE) console.log(err)
          t.ok(err)
          t.end()
        })
      })
    })
  })

  tape('source handle closed gracefully', function (t) {
    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      stuff: function (b) {
        return pull.values([1, 2, 3, 4, 5].map(function (a) {
          return a * b
        }))
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

      A.close(function (err) {
        if (err) throw err
        pull(A.stuff(5), pull.collect(function (err) {
          t.ok(err)
          if (process.env.TEST_VERBOSE) console.log(err)
          t.end()
        }))
      })
    }))
  })

  tape('sink handle closed gracefully', function (t) {
    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      things: function () {
        throw new Error('should not be called')
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
    A.close(function (err) {
      if (err) throw err
      pull(pull.values([1, 2, 3, 4, 5]), A.things(5))

      // sinks are hard to test
      // once closed, the sink (A.things) just aborts early
      // the creator of the sink (this block) has no cb after that abort
      // so we'll just make sure 100ms passes without anything exploding

      setTimeout(function () {
        t.end()
      }, 100)
    })
  })

  tape('close twice', function (t) {
    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      hello: function (a, cb) {
        cb(null, 'hello, ' + a)
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

      A.close(function (err) {
        if (err) throw err

        A.close(function (err) {
          if (err) throw err
          t.end()
        })
      })
    })
  })

  tape('wait for streams to end before closing', function (t) {
    const pushable = Pushable()
    let closed = false; let n = 2; const drained = []

    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      stuff: function () { return pushable }
    })

    const s = A.createStream()
    pull(s, B.createStream(), s)

    pull(
      A.stuff(),
      pull.drain(function (data) {
        drained.push(data)
        t.notOk(closed)
      }, function () {
        next()
      })
    )

    B.close(function () {
      closed = true
      next()
    })

    function next () {
      if (--n) return
      t.deepEqual(drained, [1, 2, 3])
      t.end()
    }

    pushable.push(1)
    setTimeout(function () {
      // this should have already gotten through,
      // but should not have closed yet.
      t.deepEqual(drained, [1])
      pushable.push(2)
      setTimeout(function () {
        t.deepEqual(drained, [1, 2])
        pushable.push(3)
        setTimeout(function () {
          t.deepEqual(drained, [1, 2, 3])
          pushable.end()
        })
      })
    })
  })

  tape('destroy streams when close(immediate, cb) is used', function (t) {
    let closed = false; let n = 3; const drained = []

    const pushable = Pushable(function () {
      next()
    })
    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      stuff: function () { return pushable }
    })

    const s = A.createStream()
    pull(s, B.createStream(), s)

    pull(
      A.stuff(),
      pull.drain(function (data) {
        drained.push(data)
        t.notOk(closed)
      }, function (err) {
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
    setTimeout(function () {
      // this should have already gotten through,
      // but should not have closed yet.
      t.deepEqual(drained, [1])
      B.close(true, function () {
        closed = true
        next()
      })

      pushable.push(2)
    })
  })
}

if (!module.parent) { module.exports() }
