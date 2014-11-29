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

tape('outer stream ends after close', function (t) {

  t.plan(3)

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

  A.close(function (err) {
    t.notOk(err)
  })

})

tape('close after uniplex streams end', function (t) {
  t.plan(4)

  var A = mux(client, null) ()
  var B = mux(null, client) ({
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

  var A = mux(client, null) ()
  var B = mux(null, client) ({
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

  t.plan(4)

  var A = mux(client, null) ()
  var B = mux(null, client) ({
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

  B.close(function (err) {
    console.log('B CLOSE')
    t.notOk(err, 'bs is closed')
  })

  A.close(function (err) {
    console.log('A CLOSE')
    t.notOk(err, 'as is closed')
  })


})
