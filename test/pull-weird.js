
const tape = require('tape')

const Weird = require('../pull-weird')

const PacketStream = require('packet-stream')

const pull = require('pull-stream')

tape('aborts pull-weird correctly', function (t) {
  t.plan(2)
  const ps = PacketStream({})

  pull(
    function (abort, cb) {
      if (abort) {
        t.ok(true)
      } else {
        cb(new Error('the stream must flow'))
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
