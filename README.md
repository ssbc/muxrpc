# muxrpc

combined rpc and multiplexing, with pull-streams.

## example

``` js

var MRPC = require('muxrpc')

//we need a manifest of methods we wish to expose.
var api = {
  //async is a normal async function
  hello: 'async',

  //source is a pull-stream (readable)
  stuff: 'source'

  //TODO: sink and duplex pull-streams
}

//pass the api into the constructor, and then pass the object you are wrapping
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

## Permissions

If you are exposing an api over a network connection,
then you probably want some sort of authorization system.
muxrpc provides some help with this, but leaves most of the trouble up to you.

``` js

var api = {
  foo: 'async',
  bar: 'async',
  auth: 'async'
}

var rpc = muxrpc(null, api, serializer)({
  foo: function (val, cb) {
    cb(null, {okay: 'foo'})
  },
  bar: function (val, cb) {
    cb(null, {okay: 'bar'})
  },
  auth: function (pass) {
    //implement an auth function that sets the permissions,
    //using allow or deny lists.

    if(pass === 'whatever')
      this.permissions({deny: ['bar']}) //allow everything except "bar"
    else if(pass === 's3cr3tz')
      this.permissions({}) //allow everything!!!
    else return cb(new Error('ACCESS DENIED'))

    //else we ARE authorized.
    cb(null, 'ACCESS GRANTED')
  }
}).permissions({allow: ['auth']})

//Get a stream to connect to the remote. As in the above example!
var ss = rpc.createStream()

```



## License

MIT
