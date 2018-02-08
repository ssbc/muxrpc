var pull = require('pull-stream')
var mux = require('../')
var tape = require('tape')

function delay(fun) {
  return function (a, b) {
    setImmediate(function () {
      fun(a, b)
    })
  }
}

var client = {
  hello  : 'async',
  goodbye: 'async',
  stuff  : 'source',
  bstuff : 'source',
  things : 'sink',
  echo   : 'duplex',
  suchstreamwow: 'duplex'
}

module.exports = function (codec) {


tape('closed is emitted when stream disconnects', function (t) {
  t.plan(2)
  var A = mux(client, null) ()
  A.on('closed', function (err) {
    console.log('EMIT CLOSED')
    t.notOk(err)
  })
  pull(pull.empty(), A.createStream(function (err) {
    console.log(err)
    t.notOk(err) //end of parent stream
  }), pull.drain())
})

tape('closed is emitted with error when stream errors', function (t) {
  t.plan(2)
  var A = mux(client, null, codec) ()
  A.on('closed', function (err) {
    t.notOk(err)
  })
  pull(pull.empty(), A.createStream(function (err) {
    console.log(err)
    t.notOk(err) //end of parent stream
  }), pull.drain())
})

}

if(!module.parent)
  module.exports(function (e) { return e })

