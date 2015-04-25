var tape = require('tape')
var pull = require('pull-stream')
var pushable = require('pull-pushable')
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
    pull(s, pull.through(console.log), B.createStream(), pull.through(console.log), s)

    A.hello('world', function (err, value) {
      if(err) throw err
      console.log(value)
      t.equal(value, 'hello, world')

      A.close(function (err) {
        if (err) throw err
        A.hello('world', function (err, value) {
          console.log(err)
          t.ok(err)
          t.end()
        })
      })
    })

  })

  tape('source handle closed gracefully', function (t) {

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      stuff: function (b) {
        return pull.values([1, 2, 3, 4, 5].map(function (a) {
          return a * b
        }))
      }
    })

    var s = A.createStream()
    pull(s, pull.through(console.log), B.createStream(), pull.through(console.log), s)

    pull(A.stuff(5), pull.collect(function (err, ary) {
      if(err) throw err
      console.log(ary)
      t.deepEqual(ary, [5, 10, 15, 20, 25])

      A.close(function (err) {
        if (err) throw err
        pull(A.stuff(5), pull.collect(function (err, ary) {
          t.ok(err)
          console.log(err)
          t.end()
        }))
      })
    }))

  })

  tape('sink handle closed gracefully', function (t) {

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      things: function (someParam) {
        throw "should not be called"
      }
    })

    var s = A.createStream()
    pull(s, pull.through(console.log), B.createStream(), pull.through(console.log), s)
    A.close(function (err) {
      if (err) throw err
      pull(pull.values([1,2,3,4,5]), A.things(5))

      // sinks are hard to test
      // once closed, the sink (A.things) just aborts early
      // the creator of the sink (this block) has no cb after that abort
      // so we'll just make sure 100ms passes without anything exploding

      setTimeout(function () {
        t.end()
      }, 100)
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
