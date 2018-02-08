var pull = require('pull-stream')
var mux = require('../')
var tape = require('tape')
var Pushable = require('pull-pushable')

function delay(fun) {
  return function (a, b) {
    setImmediate(function () {
      fun(a, b)
    })
  }
}


var client = {
  echo   : 'duplex',
  hello  : 'async',
  read   : 'source',
  write  : 'sink'
}

module.exports = function (codec) {

function testPair(name,fn) {
  tape('missing api:'+name, function (t) {
    var A = mux(client, null, codec) ()
    var B = mux(null, client, codec) ({})

    var bs = B.createStream()
    var as = A.createStream()

    pull(as, bs, as)

    fn(t, A, B)
  })
}

testPair('async', function (t, A) {
  A.hello(function (err) {
    t.ok(err)
    t.end()
  })
})

testPair('source', function (t, A) {
  pull(
    A.read(),
    pull.drain(null, function (err) {
      t.ok(err)
      t.end()
    })
  )
})

testPair('sink', function (t, A) {
  var n = 0
  pull(
    function (abort, cb) {
      if(abort) {
        console.log(abort)
        t.end()
      }
      else
        cb(null, n++)
    },
    A.write()
  )
})

testPair('duplex', function (t, A) {
  var c = 2
  var source = Pushable()
  
  pull(
    function (err, cb) {
      if(!err) setTimeout(function () { cb(null, Date.now()) })
      else {
        t.ok(true, 'aborted')
        if(!--c) t.end()
      }
    },
    A.echo(function (err) {
      console.error('caught err')
    }),
    pull.collect(function (err, ary) {
      t.ok(err)
      if(!--c) t.end()
    })
  )

})

//TODO: write test for when it's a duplex api that
//is missing on the remote!!!

}

if(!module.parent) module.exports(function (e) { return e })

