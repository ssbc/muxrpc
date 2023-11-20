const tape = require('tape')
const pull = require('pull-stream')
const mux = require('../')

function delay (fun) {
  return (a, b) => {
    setImmediate(() => {
      fun(a, b)
    })
  }
}

const id = (e) => e

const clientManf = {
  hello: 'async',
  goodbye: 'async',
  stuff: 'source',
  bstuff: 'source',
  things: 'sink',
  echo: 'duplex',
  suchstreamwow: 'duplex'
}

module.exports = function (codec) {
  tape('outer stream ends after close', (t) => {
    t.plan(4)

    const A = mux(clientManf, null, null, null, codec)
    const B = mux(null, clientManf, {
      hello (a, cb) {
        delay(cb)(null, 'hello, ' + a)
      },
      goodbye (b, cb) {
        delay(cb)(null, b)
      }
    }, null, codec)

    A.hello('jim', (err, value) => {
      if (err) throw err
      if (process.env.TEST_VERBOSE) console.log(value)
      t.equal(value, 'hello, jim')
    })

    A.goodbye('bbb', (err, value) => {
      if (err) throw err
      if (process.env.TEST_VERBOSE) console.log(value)
      t.equal(value, 'bbb')
    })

    pull(A.stream, B.stream, A.stream)

    A.on('closed', () => {
      t.ok(true)
    })

    A.close((err) => {
      t.notOk(err)
    })
  })

  tape('close after uniplex streams end', (t) => {
    t.plan(7)

    const A = mux(clientManf, null, null, null, codec)
    const B = mux(null, clientManf, {
      stuff () {
        t.ok(true)
        return pull.values([1, 2, 3, 4, 5])
      }
    }, null, codec)

    pull(A.stuff(), pull.collect((err, ary) => {
      t.error(err)
      t.deepEqual(ary, [1, 2, 3, 4, 5])
    }))

    pull(A.stream, B.stream, A.stream)

    B.on('closed', () => {
      if (process.env.TEST_VERBOSE) console.log('B emits "closed"')
      t.ok(true)
    })

    A.on('closed', () => {
      if (process.env.TEST_VERBOSE) console.log('A emits "closed"')
      t.ok(true)
    })

    B.close((err) => {
      if (process.env.TEST_VERBOSE) console.log('B CLOSE')
      t.notOk(err, 'bs is closed')
    })

    A.close((err) => {
      if (process.env.TEST_VERBOSE) console.log('A CLOSE')
      t.notOk(err, 'as is closed')
    })
  })

  tape('close after uniplex streams end 2', (t) => {
    t.plan(5)

    const A = mux(clientManf, null, null, null, codec)
    const B = mux(null, clientManf, {
      things () {
        t.ok(true)
        return pull.collect((err, ary) => {
          t.error(err)
          t.deepEqual(ary, [1, 2, 3, 4, 5])
        })
      }
    }, null, codec)

    pull(pull.values([1, 2, 3, 4, 5]), A.things())

    pull(A.stream, B.stream, A.stream)

    B.close((err) => {
      if (process.env.TEST_VERBOSE) console.log('B CLOSE')
      t.notOk(err, 'bs is closed')
    })

    A.close((err) => {
      if (process.env.TEST_VERBOSE) console.log('A CLOSE')
      t.notOk(err, 'as is closed')
    })
  })

  tape('close after both sides of a duplex stream ends', (t) => {
    t.plan(8)

    const A = mux(clientManf, null, null, null, codec)
    const B = mux(null, clientManf, {
      echo () {
        return pull.through(
          process.env.TEST_VERBOSE ? console.log : () => {},
          () => { t.ok(true) }
        )
      }
    }, null, codec)

    pull(
      pull.values([1, 2, 3, 4, 5]),
      A.echo(),
      pull.collect((err, ary) => {
        if (err) throw err
        t.deepEqual(ary, [1, 2, 3, 4, 5])
      })
    )

    pull(A.stream, B.stream, A.stream)

    t.notOk(B.closed)
    t.notOk(A.closed)

    B.on('closed', () => {
      t.ok(true)
    })

    A.on('closed', () => {
      t.ok(true)
    })

    B.close((err) => {
      if (process.env.TEST_VERBOSE) console.log('B CLOSE')
      t.notOk(err, 'bs is closed')
    })

    A.close((err) => {
      if (process.env.TEST_VERBOSE) console.log('A CLOSE', err)
      t.notOk(err, 'as is closed')
    })
  })

  tape('closed is emitted when stream disconnects', (t) => {
    t.plan(1)
    const A = mux(clientManf, null)
    A.on('closed', (err) => {
      if (process.env.TEST_VERBOSE) console.log('EMIT CLOSED')
      t.notOk(err)
    })
    pull(pull.empty(), A.stream, pull.drain())
  })

  tape('closed is emitted with error when stream errors', (t) => {
    t.plan(1)
    const A = mux(clientManf, null, null, null, codec)
    A.on('closed', (err) => {
      t.notOk(err)
    })
    pull(pull.empty(), A.stream, pull.drain())
  })
}

if (!module.parent) { module.exports(id) }
