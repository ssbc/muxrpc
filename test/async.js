

var tape = require('tape')
var mux  = require('../')
var pull = require('pull-stream')

var client = {
  async: ['hello', 'goodbye'],
  source: ['stuff']
}

var A = mux(client, null) ()
var B = mux(null, client) ({
  hello: function (a, cb) {
    cb(null, 'hello, '+a)
  },
  stuff: function (b) {
    return pull.values([1, 2, 3, 4, 5].map(function (a) {
      return a * b
    }))
  }
})

var s = A.createStream()
pull(s, pull.through(console.log), B.createStream(), s)

A.hello('world', function (err, value) {
  if(err) throw err
  console.log(value)
})

pull(A.stuff(5), pull.collect(function (err, ary) {
  if(err) throw err
  console.log(ary)
}))
