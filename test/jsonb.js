var PullSerializer = require('pull-serializer')
var JSONB = require('json-buffer')
// run tests with jsonb serialization
var codec = function(stream) {
  return PullSerializer(stream, JSONB)
}

require('./async')(codec)
require('./abort')(codec)
require('./closed')(codec)
require('./missing')(codec)




