var PullSerializer = require('pull-serializer')
var JSONB = require('json-buffer')
// run tests with jsonb serialization
require('./async')(function(stream) {
  return PullSerializer(stream, JSONB)
})
