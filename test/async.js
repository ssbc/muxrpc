var tape = require('tape')
var pull = require('pull-stream')
var mux = require('../')

module.exports = function(serializer) {
  var client = {
    async: ['hello', 'goodbye'],
    source: ['stuff', 'bstuff']
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
}

if(!module.parent)
  module.exports();
