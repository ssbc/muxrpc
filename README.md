# muxrpc

combined rpc and multiplexing, with pull-streams.

[![build status](https://secure.travis-ci.org/ssbc/muxrpc.png)](http://travis-ci.org/ssbc/muxrpc)


## motivation

`muxrpc` aims to provide remote access to any reasonable node.js api remotely.
this means it supports both streaming and async operations.
[pull-streams](https://github.com/pull-stream/pull-stream) are used.

It may seem at first that it would be logically cleaner to separate this into two concerns,
multiplexing and request-response. Indeed, we did just that in [multilevel](https://github.com/juliangruber/multilevel)
combining [mux-demux](http://github.com/dominictarr/mux-demux) and [rpc-stream](http://github.com/dominictarr/rpc-stream)
however, I realized that multiplexing depends on adding framing to incoming messages,
and so does rpc. If rpc is implemented as another layer on top of multiplexing, then the rpc messages
end up with a second layer of framing too. By implementing one protocol that supports both streams
and rpc, we were able to have both features with only a single layer of framing.

## example

```js
const Muxrpc = require('muxrpc')
const pull = require('pull-stream')
const toPull = require('stream-to-pull-stream')

//we need a manifest of methods we wish to expose.
const manifest = {
  //async is a normal async function
  hello: 'async',

  //source is a pull-stream (readable)
  stuff: 'source'

  //TODO: sink and duplex pull-streams
}

//the actual methods which the server exposes
const api = {
  hello(name, cb) {
    cb(null, 'hello, ' + name + '!')
  },
  stuff() {
    return pull.values([1, 2, 3, 4, 5])
  }
}

//pass the manifests into the constructor, and then pass the local api object you are wrapping
//(if there is a local api)
const client = Muxrpc(manifest, null)
const server = Muxrpc(null, manifest, api)
```

now set up a server, and connect to it...

```js
const net = require('net')

net.createServer(stream => {
  stream = toPull.duplex(stream) //turn into a pull-stream
  //connect the output of the net stream to the muxrpc stream
  //and then output of the muxrpc stream to the net stream
  pull(stream, server.stream, stream)
}).listen(8080)
//connect a pair of duplex streams together.

const stream = toPull.duplex(net.connect(8080))

pull(stream, client.stream, stream)

// Now you can call methods like this.
client.hello('world', function (err, value) {
  if (err) throw err
  console.log(value)
  // hello, world!
})

// Alternatively, you can use the promise syntax.
client.hello('world').then((value) => {
  console.log(value)
})

pull(client.stuff(), pull.drain(console.log))
// 1
// 2
// 3
// 4
// 5
```

## protocol

As indicated by the name, `muxrpc` combines both multiplexing and rpc (remote procedure call,
i.e. request-response). The protocol is described in details in [rpc protocol section of the protocol guide](https://ssbc.github.io/scuttlebutt-protocol-guide/#rpc-protocol)

## Api: createMuxrpc (remoteManifest, localManifest, localApi, perms, codec) => rpc

- `remoteManifest` the manifest expected on the remote end of this connection.
- `localManifest` the manifest of the methods we are exposing locally.
- `localApi` the actual methods we are exposing - this is on object with function with call types
that match the manifest.
- `perms` a permissions object with `{test: function (path, type, args) {} }` function.
- `codec` stream encoding. defaults to [packet-stream-codec](https://github.com/ssbc/packet-stream-codec)

### rpc

an [EventEmitter](https://devdocs.io/node/events#events_class_eventemitter)
containing proxies for all the methods defined in your manifest, as well as the following:

* `stream`
* `closed` a boolean, wether the instance is closed.
* `close` an async method to close this connection, will end the `rpc.stream`

And every method provided in the manifest. If a method in the manifest has the same
name as a built in, the built in will override the manifest, and you will not be able
to call that remove method.

## Manifest

`muxrpc` works with async functions, sync functions, and pull-streams.
But that javascript is dynamic, we need to tell muxrpc what sort of method
should be at what api, that is what the "mainfest" is for.
The manifest is simply an object mapping a key to one of the strings "sync" "async" "source" "sink" or "duplex",
or a nested manifest.

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

muxrpc includes a helper module for defining permissions.
it implements a simple allow/deny list to define permissions for a given connection.

```js
const Permissions = require('muxrpc/permissions')

const manifest = {
  foo: 'async',
  bar: 'async',
  auth: 'async'
}

//set initial settings
const perms = Perms({allow: ['auth']})

const rpc = muxrpc(null /* no remote manifest */, manifest, {
  foo: function (val, cb) {
    cb(null, {okay: 'foo'})
  },
  bar: function (val, cb) {
    cb(null, {okay: 'bar'})
  },
  auth: function (pass) {
    // implement an auth function that sets the permissions,
    // using allow or deny lists.

    if(pass === 'whatever')
      perms({deny: ['bar']}) // allow everything except "bar"
    else if(pass === 's3cr3tz')
      perms({}) // allow everything!!!
    else return cb(new Error('ACCESS DENIED'))

    //else we ARE authorized.
    cb(null, 'ACCESS GRANTED')
  }
}, perms, serializer) // pass the perms object to the second argument of the constructor.

// Get a stream to connect to the remote. As in the above example!
var ss = rpc.stream
```

## bootstrapping - automatically loading the remote manifest.

Sometimes you don't know the remote manifest yet. If you pass a callback
instead of `remoteManifest`, then an async method `manifest` is called on the
remote, which should return a manifest. This then used as the remote manifest
and the callback is called.

```js
const manifest = { hello: 'sync', manifest: 'sync' }

const alice = Muxrpc(null, manifest, {
  hello: function (message) {
    if(this._emit) this._emit('hello', message)
    console.log(`${this.id} received ${message}`)
    return `${message} to you too`
  },
  manifest: function () {
    return manifest
  }
})

const bob = Muxrpc(function (err, manifest) {
  if (err) throw err

  // Bob now knows Alice's API
  console.log(manifest) // => { hello: 'sync', manifest: 'sync' }

  bob.hello('aloha', (err, val) => {
    if (err) throw err
    console.log(val) // => "aloha to you too"
  })
})

pull(bob.stream, alice.stream, bob.stream)
```

## License

MIT
