

var tape = require('tape')

var Weird = require('../pull-weird')

var PacketStream = require('packet-stream')

var pull = require('pull-stream')

tape('aborts pull-weird correctly', function (t) {

  t.plan(2)
  var ps = new PacketStream({})


  pull(
    function (abort, cb) {
      if(abort) {
        t.ok(true)
      } else {
        cb('the stream must flow')
      }
    },
    Weird(ps),
    function (read) {
      read(true, function (err) {
        t.ok(err)
      })

    }
  )

  ps.destroy(true)

})
