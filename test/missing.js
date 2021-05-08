const pull = require('pull-stream')
const mux = require('../')
const tape = require('tape')

const client = {
  echo: 'duplex'
}

module.exports = function (codec) {
  tape('close after both sides of a duplex stream ends', function (t) {
    const A = mux(client, null, codec)()
    const B = mux(null, client, codec)({
    })

    const bs = B.createStream()
    const as = A.createStream()

    pull(
      function (err, cb) {
        if (!err) setTimeout(function () { cb(null, Date.now()) })
        else if (process.env.TEST_VERBOSE) console.log('ERROR', err)
      },
      A.echo(function () {
        if (process.env.TEST_VERBOSE) console.error('caught err')
      }),
      pull.collect(function (err) {
        t.ok(err)
        t.end()
      })
    )

    pull(as, bs, as)
  })

  // TODO: write test for when it's a duplex api that
  // is missing on the remote!!!
}

if (!module.parent) module.exports(function (e) { return e })
