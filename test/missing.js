const tape = require('tape')
const pull = require('pull-stream')
const mux = require('../')

const client = {
  echo: 'duplex'
}

const id = (e) => e

module.exports = function (codec) {
  tape('close after both sides of a duplex stream ends', (t) => {
    const A = mux(client, null, null, null, codec)
    const B = mux(null, client, {}, null, codec)

    const bs = B.stream
    const as = A.stream

    pull(
      (err, cb) => {
        if (!err) setTimeout(() => { cb(null, Date.now()) })
        else if (process.env.TEST_VERBOSE) console.log('ERROR', err)
      },
      A.echo(() => {
        if (process.env.TEST_VERBOSE) console.error('caught err')
      }),
      pull.collect((err) => {
        t.ok(err)
        t.end()
      })
    )

    pull(as, bs, as)
  })

  // TODO: write test for when it's a duplex api that
  // is missing on the remote!!!
}

if (!module.parent) module.exports(id)
