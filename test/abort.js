
var mux  = require('../')
var tape = require('tape')
var pull = require('pull-stream')
var Abortable = require('pull-abortable')

function id (e) { return e }

function abortStream(onAbort, onAborted) {
  return function (read) {
    return function (abort, cb) {
      if(abort && onAbort) onAbort(abort)
      read(abort, function (end, data) {
        if(end && onAborted) onAborted(end)
        cb(end, data)
      })
    }
  }
}

module.exports = function (serializer) {
  tape('stream abort 1', function (t) {
    t.plan(2)

    var client = {
      drainAbort: 'sink'
    }

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      drainAbort: function (n) {
        return pull(
          pull.take(n),
          pull.through(console.log),
          pull.collect(function (err, ary) {
            t.deepEqual(ary, [1, 2, 3])
          })
        )
      }
    })

    var as = A.createStream()
    var bs = B.createStream()

    pull(as, bs, as)

    var sent = []

    pull(
      pull.values([1,2,3,4,5,6,7,8,9,10], function (abort) {
        t.ok(sent.length < 10, 'sent is correct')
      }),
      pull.through(console.log),
      pull.asyncMap(function (data, cb) {
        setTimeout(function () {
          cb(null, data)
        })
      }),
      pull.through(sent.push.bind(sent)),
      A.drainAbort(3)
    )

  })

  tape('stream abort 2', function (t) {
    t.plan(2)
    var c = 2

    var abortable = Abortable()
    var client = {
      drainAbort: 'sink'
    }

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      drainAbort: function (n) {
        return pull(
          pull.through(function (d) {
            console.log('receive', d)
            if(--n) return
            abortable.abort()
          }, function (err) {
            console.log('END', err)
          }),
          pull.collect(function (err, ary) {
            t.deepEqual(ary, [1, 2, 3])
            if(!--c) t.end()
          })
        )
      }
    })

    var as = A.createStream()
    var bs = B.createStream()

    pull(as, abortable, bs, as)

    var sent = []

    pull(
      pull.values([1,2,3,4,5,6,7,8,9,10], function (abort) {
        t.ok(sent.length < 10, 'sent is correct')
        if(!--c) t.end()
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

