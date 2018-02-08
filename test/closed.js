var tape = require('tape')
var pull = require('pull-stream')
var Pushable = require('pull-pushable')
var mux = require('../')

module.exports = function(serializer) {
  var client = {
    hello  : 'async',
    goodbye: 'async',
    stuff  : 'source',
    bstuff : 'source',
    things : 'sink',
    suchstreamwow: 'duplex'
  }

  tape('async handle closed gracefully', function (t) {

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      hello: function (a, cb) {
        cb(null, 'hello, '+a)
      }
    })

    var s = A.createStream()
    pull(s, B.createStream(), s)

    A.hello('world', function (err, value) {
      if(err) throw err
      console.log(value)
      t.equal(value, 'hello, world')

      A.close(function (err) {
        if (err) throw err
        console.log('closed')
        A.hello('world', function (err, value) {
          t.ok(err)
          t.end()
        })
      })
    })

  })
  tape('close twice', function (t) {

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      hello: function (a, cb) {
        cb(null, 'hello, '+a)
      }
    })

    var s = A.createStream()
    pull(s, pull.through(console.log), B.createStream(), pull.through(console.log), s)

    A.hello('world', function (err, value) {
      if(err) throw err
      console.log(value)
      t.equal(value, 'hello, world')

      A.close(function (err) {
        if (err) throw err

        A.close(function (err) {
          if (err) throw err
          t.end()
        })
      })
    })
  })

}

if(!module.parent)
  module.exports();

