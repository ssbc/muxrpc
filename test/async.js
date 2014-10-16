

var tape = require('tape')
var mux  = require('../')
var pull = require('pull-stream')

var client = {
  async: ['hello', 'goodbye'],
  source: ['stuff']
}

tape('async', function (t) {

  var A = mux(client, null) ()
  var B = mux(null, client) ({
    hello: function (a, cb) {
      cb(null, 'hello, '+a)
    },
  })

  var s = A.createStream()
  pull(s, pull.through(console.log), B.createStream(), s)

  A.hello('world', function (err, value) {
    if(err) throw err
    console.log(value)
    t.equal(value, 'hello, world')
    t.end()
  })

})

tape('source', function (t) {

  var A = mux(client, null) ()
  var B = mux(null, client) ({
    stuff: function (b) {
      return pull.values([1, 2, 3, 4, 5].map(function (a) {
        return a * b
      }))
    }
  })

  var s = A.createStream()
  pull(s, pull.through(console.log), B.createStream(), s)

  pull(A.stuff(5), pull.collect(function (err, ary) {
    if(err) throw err
    console.log(ary)
    t.deepEqual(ary, [5, 10, 15, 20, 25])
    t.end()
  }))

})

tape('async - error', function (t) {
  var A = mux(client, null) ()

  var s = A.createStream()

  A.hello('world', function (err, value) {
    t.ok(err)
    t.end()
  })

  s.sink(function (abort, cb) { cb(true) })
})


tape('async - error', function (t) {
  var A = mux(client, null) ()

  var s = A.createStream()

  A.hello('world', function (err, value) {
    console.log('CB!')
    t.ok(err)
    t.end()
  })

  s.source(true, function () {})
})

tape('buffer calls before stream is created', function (t) {
  var A = mux(client, null) ()
  var B = mux(null, client) ({
    hello: function (a, cb) {
      cb(null, 'hello, '+a)
    },
  })

  A.hello('world', function (err, value) {
    if(err) throw err
    console.log(value)
    t.equal(value, 'hello, world')
    t.end()
  })

  var s = A.createStream()
  pull(s, B.createStream(), s)

})

tape('async - error', function (t) {
  var A = mux(client, null) ()

  var s = A.createStream()

  A.hello('world', function (err, value) {
    t.ok(err)

    var B = mux(null, client) ({
      hello: function (a, cb) {
        cb(null, 'hello, '+a)
      },
    })

    var s = A.createStream()

    pull(s, B.createStream(), s)

    A.hello('world', function (err, value) {
      t.notOk(err)
      t.equal(value, 'hello, world')
      t.end()
    })
  })

  s.sink(function (abort, cb) { cb(true) })
})

