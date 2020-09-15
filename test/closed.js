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
    pull(s, pull.through(console.log), B.createStream(), pull.through(console.log), s)

    A.hello('world', function (err, value) {
      if(err) throw err
      console.log(value)
      t.equal(value, 'hello, world')

      A.close(function (err) {
        if (err) throw err
        A.hello('world', function (err) {
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
        pull(A.stuff(5), pull.collect(function (err) {
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
      things: function () {
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

  tape('wait for streams to end before closing', function (t) {

    var pushable = Pushable()
    var closed = false, n = 2, drained = []

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      stuff: function () { return pushable }
    })

    var s = A.createStream()
    pull(s, B.createStream(), s)

    pull(
      A.stuff(),
      pull.drain(function (data) {
        drained.push(data)
        t.notOk(closed)
      }, function () {
        next()
      })
    )

    B.close(function () {
      closed = true
      next()
    })

    function next () {
      if(--n) return
      t.deepEqual(drained, [1,2,3])
      t.end()
    }

    pushable.push(1)
    setTimeout(function () {
      //this should have already gotten through,
      //but should not have closed yet.
      t.deepEqual(drained, [1])
      pushable.push(2)
      setTimeout(function () {
        t.deepEqual(drained, [1, 2])
        pushable.push(3)
        setTimeout(function () {
          t.deepEqual(drained, [1, 2, 3])
          pushable.end()
        })
      })
    })
  })

  tape('destroy streams when close(immediate, cb) is used', function (t) {

    var closed = false, n = 3, drained = []

    var pushable = Pushable(function () {
      next()
    })
    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      stuff: function () { return pushable }
    })

    var s = A.createStream()
    pull(s, B.createStream(), s)

    pull(
      A.stuff(),
      pull.drain(function (data) {
        drained.push(data)
        t.notOk(closed)
      }, function (err) {
        t.ok(err)
        next()
      })
    )

    function next () {
      if(--n) return
      t.deepEqual(drained, [1])
      t.end()
    }

    pushable.push(1)
    setTimeout(function () {
      //this should have already gotten through,
      //but should not have closed yet.
      t.deepEqual(drained, [1])
      B.close(true, function () {
        closed = true
        next()
      })

      pushable.push(2)
    })
  })


}

if(!module.parent)
  module.exports();
