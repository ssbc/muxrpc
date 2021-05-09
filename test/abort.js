const tape = require('tape')
const pull = require('pull-stream')
const Abortable = require('pull-abortable')
const mux = require('../')

const id = (e) => e

module.exports = function (serializer) {
  tape('stream abort', (t) => {
    t.plan(3)
    const abortable = Abortable()
    const client = {
      drainAbort: 'sink'
    }

    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      drainAbort: (n) => {
        return pull(
          pull.through(() => {
            if (--n) return
            abortable.abort()
          }),
          pull.collect((err, ary) => {
            t.match(err.message, /unexpected end of parent stream/)
            if (process.env.TEST_VERBOSE) console.log(ary)
            t.deepEqual(ary, [1, 2, 3])
          })
        )
      }
    })

    const as = A.createStream()
    const bs = B.createStream()

    pull(as, abortable, bs, as)

    const sent = []

    pull(
      pull.values([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (abort) => {
        if (process.env.TEST_VERBOSE) console.log(abort)
        t.ok(sent.length < 10, 'sent is correct')
        t.end()
      }),
      pull.asyncMap((data, cb) => {
        setImmediate(() => {
          cb(null, data)
        })
      }),
      pull.through(sent.push.bind(sent)),
      A.drainAbort(3)
    )
  })
}

module.exports(id)
