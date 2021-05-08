
const mux = require('../')
const tape = require('tape')
const pull = require('pull-stream')
const Abortable = require('pull-abortable')

function id (e) { return e }

module.exports = function (serializer) {
  tape('stream abort', function (t) {
    t.plan(3)
    const abortable = Abortable()
    const client = {
      drainAbort: 'sink'
    }

    const A = mux(client, null, serializer)()
    const B = mux(null, client, serializer)({
      drainAbort: function (n) {
        return pull(
          pull.through(function () {
            if (--n) return
            abortable.abort()
          }),
          pull.collect(function (err, ary) {
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
      pull.values([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], function (abort) {
        if (process.env.TEST_VERBOSE) console.log(abort)
        t.ok(sent.length < 10, 'sent is correct')
        t.end()
      }),
      pull.asyncMap(function (data, cb) {
        setImmediate(function () {
          cb(null, data)
        })
      }),
      pull.through(sent.push.bind(sent)),
      A.drainAbort(3)
    )
  })
}

module.exports(id)
