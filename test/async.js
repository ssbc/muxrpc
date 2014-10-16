

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
