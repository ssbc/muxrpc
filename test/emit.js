var tape = require('tape')
var pull = require('pull-stream')
var pushable = require('pull-pushable')
var mux = require('../')

module.exports = function(serializer) {
  tape('async', function (t) {

    var A = mux({}, {}, serializer) ({})
    var B = mux({}, {}, serializer) ({})

    var as = A.createStream()
    var bs = B.createStream()

    pull(as, bs, as)

    var start = Date.now(), mid, end

    A.on('ping', function (ts) {
      mid = Date.now()
      t.equal(ts, start)
      t.ok(ts <= mid)
      A.emit('pong', mid)
    })

    B.on('pong', function (ts) {
      end = Date.now()
      t.equal(ts, mid)
      t.ok(ts <= end)
      t.end()
    })

    B.emit('ping', start)
  })
}

module.exports(function (e) { return e })
