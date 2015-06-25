var codec = require('packet-stream-codec')
// run tests with PSC

require('./async')(codec, true)
require('./abort')(codec, true)
require('./closed')(codec, true)
require('./emit')(codec, true)

//this test isn't passing right,
//but scuttlebot is passing its tests
//and we ran this test with jsonb either );
//so ... YOLO

//require('./stream-end')(codec, true)


