# muxrpc

combined rpc and multiplexing, with pull-streams.

[![build status](https://secure.travis-ci.org/ssbc/muxrpc.png)](http://travis-ci.org/ssbc/muxrpc)


## example

``` js

var MRPC = require('muxrpc')
var pull = require('pull-stream')

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
})

var a = client.createStream()
var b = server.createStream()

pull(a, b, a) //pipe together

client.hello('world', function (err, value) {
  if(err) throw err
  console.log(value)
  // hello, world!
})

pull(client.stuff(), pull.drain(console.log))
// 1
// 2
// 3
// 4
// 5
```

## Manifest

like multilevel, a [manifest is required](https://github.com/juliangruber/multilevel#plugins)
except it works a little differently, and since muxrpc works with any api,
not assuming leveldb then you must write the manifest yourself.

The manifest is simply an object mapping to strings, or nested objects.

``` js
{
  foo: 'async',        //a function with a callback.
  bar: 'sync',         //a function that returns a value
                       //(note this is converted to an async function for the client)
  allTheFoos: 'source' //a source pull-stream (aka, readable)
  writeFoos: 'sink',   //a sink pull-stream (aka, writable)
  fooPhone: 'duplex',  //a duplex pull-stream

  //create nested objects like this:
  bar: {
    ...
  }
}

```

## Permissions

If you are exposing an api over a network connection,
then you probably want some sort of authorization system.
`muxrpc@4` and earlier had a `rpc.permissions()` method on
the rpc object, but this has been removed.
Now you must pass a permissions function, which is called with
the `name` (a path) and `args`, if this function does not throw
an error, then the call is allowed.

In some cases, a simple allow/deny list is sufficient.
A helper function, is provided, which was a part of muxrpc@4

``` js

var Permissions = require('muxrpc/permissions')

var api = {
  foo: 'async',
  bar: 'async',
  auth: 'async'
}

//set initial settings
var perms = Perms({allow: ['auth']})

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
      perms({deny: ['bar']}) //allow everything except "bar"
    else if(pass === 's3cr3tz')
      perms({}) //allow everything!!!
    else return cb(new Error('ACCESS DENIED'))

    //else we ARE authorized.
    cb(null, 'ACCESS GRANTED')
  }
}, perms)

//Get a stream to connect to the remote. As in the above example!
var ss = rpc.createStream()

```



## License

MIT



