var pull = require('pull-stream')
var mux = require('../')
var tape = require('tape')
var Pushable = require('pull-pushable')

function delay(fun) {
  return function (a, b) {
    setImmediate(function () {
      fun(a, b)
    })
  }
}


var client = {
  echo   : 'duplex',
}

module.exports = function (codec) {

tape('close after both sides of a duplex stream ends', function (t) {

  var A = mux(client, null, codec) ()
  var B = mux(null, client, codec) ({
  })

  var bs = B.createStream()
  var as = A.createStream()

  var source = Pushable()

  pull(
    function (err, cb) {
      if(!err) setTimeout(function () { cb(null, Date.now()) })
      else console.log('ERROR', err)
    },
    A.echo(function (err) {
      console.error('caught err')
    }),
    pull.collect(function (err, ary) {
      t.ok(err)
      t.end()
    })
  )

  pull(as, bs, as)

})

//TODO: write test for when it's a duplex api that
//is missing on the remote!!!

}

if(!module.parent) module.exports(function (e) { return e })








