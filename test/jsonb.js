const PullSerializer = require('pull-serializer')
const JSONB = require('json-buffer')

// run tests with jsonb serialization
const codec = function (stream) {
  return PullSerializer(stream, JSONB)
}

require('./async')(codec)

// YOLO

// require('./abort')(codec)
// require('./closed')(codec)
// require('./emit')(codec)
// require('./stream-end')(codec)
//
