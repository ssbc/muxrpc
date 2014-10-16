# muxrpc

combined rpc and multiplexing, with pull-streams.

## example

``` js

var MRPC = require('muxrpc')

//we need a manifest of methods we wish to expose.
var api = {
  //async is a normal async function
  async: ['hello'],

  //source is a pull-stream (readable)
  source: ['stuff']

  //TODO: sink and duplex pull-streams
}

//pass the api into the contructor, and then pass the object you are wrapping
//(if there is a local api)
var client = MRPC(api, null) () //remoteApi, localApi
var server = MRPC(null, api) ({
  hello: function (name, cb) {
    cb(null, 'hello, ' + name + '!')
  },
  stuff: function () {
    return pull.values([1, 2, 3, 4, 5])
  }
}

var a = client.createStream()
var b = server.createStream()

pull(a, b, a) //pipe together

a.hello('world', function (err, value) {
  if(err) throw err
  console.log(value)
  // hello, world!
})

pull(a.stuff(), pull.drain(console.log))
// 1
// 2
// 3
// 4
// 5
```

## License

MIT
