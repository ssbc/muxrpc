var tape = require('tape')
var pull = require('pull-stream')
var pushable = require('pull-pushable')
var mux = require('../')

module.exports = function(serializer) {
  var client = {
    async: ['hello', 'goodbye'],
    source: ['stuff', 'bstuff'],
    sink: ['things'],
    duplex: ['suchstreamwow']
  }

  tape('async', function (t) {

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      hello: function (a, cb) {
        cb(null, 'hello, '+a)
      },
      goodbye: function(b, cb) {
        cb(null, b)
      }
    })

    var s = A.createStream()
    pull(s, pull.through(console.log), B.createStream(), pull.through(console.log), s)

    A.hello('world', function (err, value) {
      if(err) throw err
      console.log(value)
      t.equal(value, 'hello, world')

      var buf = new Buffer([0, 1, 2, 3, 4])
      A.goodbye(buf, function (err, buf2) {
        if (err) throw err
        t.deepEqual(buf2, buf)
        t.end()
      })
    })


  })

  tape('source', function (t) {

    var expected = [
          new Buffer([0, 1]),
          new Buffer([2, 3]),
          new Buffer([4, 5])
        ]

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      stuff: function (b) {
        return pull.values([1, 2, 3, 4, 5].map(function (a) {
          return a * b
        }))
      },
      bstuff: function() {
        return pull.values(expected)
      }
    })

    var s = A.createStream()
    pull(s, pull.through(console.log), B.createStream(), pull.through(console.log), s)

    pull(A.stuff(5), pull.collect(function (err, ary) {
      if(err) throw err
      console.log(ary)
      t.deepEqual(ary, [5, 10, 15, 20, 25])

      pull(A.bstuff(), pull.collect(function(err, ary) {
        if (err) throw err
        t.deepEqual(ary, expected)
        t.end()
      }))
    }))

  })

  tape('sink', function (t) {

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      things: function (someParam) {
        return pull.collect(function(err, values) {
          if (err) throw err
          t.equal(someParam, 5)
          t.deepEqual(values, [1, 2, 3, 4, 5])
          t.end()
        })
      }
    })

    var s = A.createStream()
    pull(s, pull.through(console.log), B.createStream(), pull.through(console.log), s)
    pull(pull.values([1,2,3,4,5]), A.things(5))
  })

  tape('duplex', function (t) {

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      suchstreamwow: function (someParam) {
        // did the param come through?
        t.equal(someParam, 5)

        // normally, we'd use pull.values and pull.collect
        // however, pull.values sends 'end' onto the stream, which closes the muxrpc stream immediately
        // ...and we need the stream to stay open for the drain to collect
        var nextValue = 0
        var p = pushable()
        for (var i=0; i < 5; i++)
          p.push(i)
        return {
          source: p,
          sink: pull.drain(function(value) {
            t.equal(nextValue, value)
            nextValue++
            if (nextValue == 5)
              t.end()
          })
        }
      }
    })

    var s = A.createStream()
    pull(s, pull.through(console.log.bind(console, 'IN')), B.createStream(), pull.through(console.log.bind(console,'OUT')), s)
    var dup = A.suchstreamwow(5)
    pull(dup, dup)
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

  tape('recover error written to outer stream', function (t) {

    var A = mux(client, null) ()
    var err = new Error('testing errors')
    var s = A.createStream(function (_err) {
      t.equal(_err, err)
      t.end()
    })

    pull(pull.error(err), s.sink)

  })

  tape('recover error when outer stream aborted', function (t) {

    var A = mux(client, null) ()
    var err = new Error('testing errors')
    var s = A.createStream(function (_err) {
      t.equal(_err, err)
      t.end()
    })

    s.source(err, function () {})
  })

  tape('cb when stream is ended', function (t) {

    var A = mux(client, null) ()
    var s = A.createStream(function (_err) {
      t.equal(_err, null)
      t.end()
    })

    pull(pull.empty(), s.sink)

  })

  tape('cb when stream is aborted', function (t) {

    var A = mux(client, null) ()
    var s = A.createStream(function (_err) {
      t.equal(_err, null)
      t.end()
    })

    s.source(true, function () {})
  })

  var client2 = {
    async: ['salutations.hello', 'salutations.goodbye'],
  }


  tape('nested methods', function (t) {
    var A = mux(client2, null, serializer) ()
    var B = mux(null, client2, serializer) ({
      salutations: {
        hello: function (a, cb) {
          cb(null, 'hello, '+a)
        },
        goodbye: function(b, cb) {
          cb(null, b)
        }
      }
    })

    var s = A.createStream()
    pull(s, pull.through(console.log), B.createStream(), pull.through(console.log), s)

    A.salutations.hello('world', function (err, value) {
      if(err) throw err
      console.log(value)
      t.equal(value, 'hello, world')

      var buf = new Buffer([0, 1, 2, 3, 4])
      A.salutations.goodbye(buf, function (err, buf2) {
        if (err) throw err
        t.deepEqual(buf2, buf)
        t.end()
      })
    })

  })

}

//see ./jsonb.js for tests with serialization.
if(!module.parent)
  module.exports();
