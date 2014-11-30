


var permissions = require('../permissions')

var tape = require('tape')

tape('whitelist', function (t) {

  var p = permissions()

  p({allow: ['foo', 'bar', 'baz']})

  console.log(p)

  t.ifError(p.test('foo'))
  t.ifError(p.test('bar'))
  t.ifError(p.test('baz'))

  t.ok(p.test('xxx'))
  t.ok(p.test('whatever'))

  t.end()
})

tape('nested whitelist', function (t) {
  var p = permissions()

  p({allow: ['foo']})

  t.ifError(p.test(['foo', 'quxx']))
  t.end()

})

tape('nested blacklist', function (t) {

  var p = permissions()

  p({deny: ['foo']})

  t.ok(p.test(['foo', 'quxx']))
  t.end()

})


tape('deep blacklist', function (t) {

  var p = permissions()

  p({deny: [['foo', 'quxx']]})

  t.ok(p.test(['foo', 'quxx']))
  t.notOk(p.test(['foo', 'bar']))
  t.end()

})


