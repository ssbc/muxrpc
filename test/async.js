var tape = require('tape')
var pull = require('pull-stream')
var mux = require('../')

module.exports = function(serializer) {
  var client = {
    async: ['hello', 'goodbye'],
    source: ['stuff', 'bstuff'],
    sink: ['things']
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
        t.equal(buf2.length, 5)
        t.equal(buf2.readUInt8(0), 0)
        t.equal(buf2.readUInt8(1), 1)
        t.equal(buf2.readUInt8(2), 2)
        t.equal(buf2.readUInt8(3), 3)
        t.equal(buf2.readUInt8(4), 4)
        t.end()
      })
    })


  })

  tape('source', function (t) {

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      stuff: function (b) {
        return pull.values([1, 2, 3, 4, 5].map(function (a) {
          return a * b
        }))
      },
      bstuff: function() {
        return pull.values([
          new Buffer([0, 1]),
          new Buffer([2, 3]),
          new Buffer([4, 5])
        ])
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
        console.log(ary)
        t.equal(ary[0].length, 2)
        t.equal(ary[0].readUInt8(0), 0)
        t.equal(ary[0].readUInt8(1), 1)
        t.equal(ary[1].length, 2)
        t.equal(ary[1].readUInt8(0), 2)
        t.equal(ary[1].readUInt8(1), 3)
        t.equal(ary[2].length, 2)
        t.equal(ary[2].readUInt8(0), 4)
        t.equal(ary[2].readUInt8(1), 5)
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
          t.equal(values.length, 5)
          t.equal(values[0], 1)
          t.equal(values[1], 2)
          t.equal(values[2], 3)
          t.equal(values[3], 4)
          t.equal(values[4], 5)
          t.end()
        })
      }
    })

    var s = A.createStream()
    pull(s, pull.through(console.log), B.createStream(), pull.through(console.log), s)
    pull(pull.values([1,2,3,4,5]), A.things(5))
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

}

//see ./jsonb.js for tests with serialization.
if(!module.parent)
  module.exports();
