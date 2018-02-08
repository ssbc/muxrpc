var tape = require('tape')
var pull = require('pull-stream')
var pushable = require('pull-pushable')
var mux = require('../')

module.exports = function(serializer, buffers) {

  var b = buffers
  ? function (b) {
    return (
        Buffer.isBuffer(b)
        //reserialize, to take into the account
        //changes Buffer#toJSON between 0.10 and 0.12
      ? JSON.parse(JSON.stringify(b))
      : b
    )
  }
  : function (b) { return b }

  var client = {
    hello  : 'async',
    goodbye: 'async',
    stuff  : 'source',
    bstuff : 'source',
    things : 'sink',
    suchstreamwow: 'duplex'
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

    function log(name) {
      return pull.through(function (data) {
        console.log(name, data)
      })
    }

    var s = A.createStream()
    pull(s, log('a->b'), B.createStream(), log('b->a'), s)
    A.hello('world', function (err, value) {
      if(err) throw err
      console.log(value)
      t.equal(value, 'hello, world')

      var buf = new Buffer([0, 1, 2, 3, 4])
      A.goodbye(buf, function (err, buf2) {
        if (err) throw err
        console.log(b(buf2), b(buf))
        t.deepEqual(b(buf2), b(buf))
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
        console.log(ary.map(b), expected.map(b))
        t.deepEqual(ary.map(b), expected.map(b))
        t.end()
      }))
    }))

  })

  tape('sync', function (t) {
    var client = {
      syncOk : 'sync',
      syncErr: 'sync'
    }

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      syncOk: function (a) {
        return {okay: a}
      },
      syncErr: function(b) {
        throw new Error('test error:'+b)
      }
    })

    var s = A.createStream()
    pull(s, B.createStream(), s)

    A.syncOk(true, function (err, value) {
      t.deepEqual(value, {okay: true})
      A.syncErr('blah', function (err) {
        t.equal(err.message, 'test error:blah')
        t.end()
      })
    })

  })

  tape('sink 1', function (t) {

    var A = mux(client, null, serializer) ()
    var B = mux(null, client, serializer) ({
      things: function (someParam) {
        console.log('stream:things', someParam)
        return pull.collect(function(err, values) {
          if (err) throw err
          t.equal(someParam, 5)
          t.deepEqual(values, [1, 2, 3, 4, 5])
          t.end()
        })
      }
    })

    var s = A.createStream()
    pull(s, B.createStream(), s)

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
            console.log('************', nextValue, value)
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

  tape('async - error1', function (t) {
    var A = mux(client, null) ()

    var s = A.createStream()

    A.hello('world', function (err, value) {
      t.ok(err)
      t.end()
    })

    s.sink(function (abort, cb) { cb(true) })
  })

  tape('async - error2', function (t) {
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

//  tape('async - error, and reconnect', function (t) {
//    var A = mux(client, null) ()
//
//    var s = A.createStream()
//
//    A.hello('world', function (err, value) {
//      t.ok(err)
//
//      var B = mux(null, client) ({
//        hello: function (a, cb) {
//          cb(null, 'hello, '+a)
//        },
//      })
//
//      var s = A.createStream()
//
//      pull(s, B.createStream(), s)
//
//      A.hello('world', function (err, value) {
//        t.notOk(err)
//        t.equal(value, 'hello, world')
//        t.end()
//      })
//    })
//
//    s.sink(function (abort, cb) { cb(true) })
//  })

//disabled this api because I'm pretty sure we don't
//use it anywhere in sbot and it looks like it will take a while
//to debug.

//  tape('recover error written to outer stream', function (t) {
//
//    var A = mux(client, null) ()
//    var err = new Error('testing errors')
//    var s = A.createStream(function (_err) {
//      t.equal(_err, err)
//      t.end()
//    })
//
//    pull(pull.error(err), s.sink)
//
//  })
//
//  tape('recover error when outer stream aborted', function (t) {
//
//    var A = mux(client, null) ()
//    var err = new Error('testing errors')
//    var s = A.createStream(function (_err) {
//      t.equal(_err, err)
//      t.end()
//    })
//
//    s.source(err, function () {})
//  })
//
//  tape('cb when stream is ended', function (t) {
//
//    var A = mux(client, null) ()
//    var s = A.createStream(function (_err) {
//      t.equal(_err, null)
//      t.end()
//    })
//
//    pull(pull.empty(), s.sink)
//
//  })
//
//  tape('cb when stream is aborted', function (t) {
//
//    var A = mux(client, null) ()
//    var s = A.createStream(function (_err) {
//      t.equal(_err, null)
//      t.end()
//    })
//
//    s.source(true, function () {})
//  })

  var client2 = {
    salutations: {
      hello: 'async',
      goodbye: 'async'
    }
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
        t.deepEqual( b(buf2), b(buf))
        t.end()
      })
    })

  })

  tape('sink end cb', function (t) {
    var A = mux(client, null, serializer)()
    var B = mux(null, client, serializer)({
      things: function (len) {
        return pull(
          pull.through(console.log),
          pull.collect(function (err, ary) {
            t.equal(ary.length, len)
          })
        )
      }
    })

    var s = A.createStream(); pull(s, B.createStream(), s)

    pull(
      pull.values([1,2,3]),
      A.things(3, function (err) {
        if(err) throw err
        t.end()
      })
    )
  })

  tape('sink - abort', function (t) {
    var err = new Error('test abort error')

    var A = mux(client, null, serializer)()
    var B = mux(null, client, serializer)({
      things: function (len) {
        return function (read) {
          read(err, function () {})
        }
      }
    })

    var s = A.createStream(); pull(s, B.createStream(), s)

    pull(pull.values([1,2,3]), A.things(3, function (_err) {
      t.ok(_err)
      console.log(_err)
      t.equal(_err.message, err.message)
      t.end()
    }))

  })

}

//see ./jsonb.js for tests with serialization.
if(!module.parent)
  module.exports(function (e) { return e });


