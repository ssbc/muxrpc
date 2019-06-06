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

tape('outer stream ends after close', function (t) {

  t.plan(4)

  var A = mux(client, null, codec) ()
  var B = mux(null, client, codec) ({
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

  A.on('closed', function () {
    t.ok(true)
  })

  A.close(function (err) {
    t.notOk(err)
  })

})

tape('close after uniplex streams end', function (t) {
  t.plan(6)

  var A = mux(client, null, codec) ()
  var B = mux(null, client, codec) ({
    stuff: function () {
      t.ok(true)
      return pull.values([1, 2, 3, 4, 5])
    }
  })

  pull(A.stuff(), pull.collect(function (err, ary) {
    t.deepEqual(ary, [1, 2, 3, 4, 5])
  }))

  var bs = B.createStream()
  var as = A.createStream()
  pull(as, bs, as)

  B.on('closed', function () {
    console.log('B emits "closed"')
    t.ok(true)
  })

  A.on('closed', function () {
    console.log('A emits "closed"')
    t.ok(true)
  })

  B.close(function (err) {
    console.log('B CLOSE')
    t.notOk(err, 'bs is closed')
  })

  A.close(function (err) {
    console.log('A CLOSE')
    t.notOk(err, 'as is closed')
  })
})

tape('close after uniplex streams end 2', function (t) {
  t.plan(4)

  var A = mux(client, null, codec) ()
  var B = mux(null, client, codec) ({
    things: function () {
      t.ok(true)
      return pull.collect(function (err, ary) {
        t.deepEqual(ary, [1, 2, 3, 4, 5])
      })
    }
  })

  pull(pull.values([1, 2, 3, 4, 5]), A.things())

  var bs = B.createStream()
  var as = A.createStream()

  pull(as, bs, as)

  B.close(function (err) {
    console.log('B CLOSE')
    t.notOk(err, 'bs is closed')
  })

  A.close(function (err) {
    console.log('A CLOSE')
    t.notOk(err, 'as is closed')
  })
})

tape('close after both sides of a duplex stream ends', function (t) {

  t.plan(8)

  var A = mux(client, null, codec) ()
  var B = mux(null, client, codec) ({
    echo: function () {
      return pull.through(console.log, function () {
        t.ok(true)
      })
    }
  })

  var bs = B.createStream()
  var as = A.createStream()

  pull(
    pull.values([1, 2, 3, 4, 5]),
    A.echo(),
    pull.collect(function (err, ary) {
      if(err) throw err
      t.deepEqual(ary, [1,2,3,4,5])
    })
  )

  pull(as, bs, as)

  t.notOk(B.closed)
  t.notOk(A.closed)

  B.on('closed', function () {
    t.ok(true)
  })

  A.on('closed', function () {
    t.ok(true)
  })

  B.close(function (err) {
    console.log('B CLOSE')
    t.notOk(err, 'bs is closed')
  })

  A.close(function (err) {
    console.log('A CLOSE', err)
    t.notOk(err, 'as is closed')
  })


})

tape('closed is emitted when stream disconnects', function (t) {
  t.plan(2)
  var A = mux(client, null) ()
  A.on('closed', function (err) {
    console.log('EMIT CLOSED')
    t.notOk(err)
  })
  pull(pull.empty(), A.createStream(function (err) {
//    console.log(err)
    t.ok(err) //end of parent stream
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
