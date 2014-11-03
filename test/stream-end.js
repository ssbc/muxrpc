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

tape('outer stream ends after close', function (t) {

  t.plan(3)

  var client = {
    async: ['hello', 'goodbye'],
    source: ['stuff', 'bstuff'],
    sink: ['things'],
    duplex: ['suchstreamwow']
  }

  var A = mux(client, null) ()
  var B = mux(null, client) ({
    hello: function (a, cb) {
      delay(cb)(null, 'hello, '+a)
    },
    goodbye: function(b, cb) {
      delay(cb)(null, b)
    }
  })


  A.hello('jim', function (err, value) {
    if(err) throw err
    console.log(value)
    t.equal(value, 'hello, jim')
  })

  A.goodbye('bbb', function (err, value) {
    if(err) throw err
    console.log(value)
    t.equal(value, 'bbb')
  })

  var bs = B.createStream()

  var as = A.createStream()
  pull(as, bs, as)

  bs.close(function (err) {
    t.notOk(err)
  })

})
