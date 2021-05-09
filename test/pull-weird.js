
const tape = require('tape')
const pull = require('pull-stream')
const PacketStream = require('packet-stream')
const Weird = require('../pull-weird')

tape('aborts pull-weird correctly', (t) => {
  t.plan(2)
  const ps = PacketStream({})

  pull(
    (abort, cb) => {
      if (abort) {
        t.ok(true)
      } else {
        cb(new Error('the stream must flow'))
      }
    },
    Weird(ps),
    (read) => {
      read(true, (err) => {
        t.ok(err)
      })
    }
  )

  ps.destroy(true)
})
