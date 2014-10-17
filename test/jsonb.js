var PullSerializer = require('pull-serializer')

// run tests with jsonb serialization
require('./async')(function(stream) { return PullSerializer(stream, require('json-buffer')) })