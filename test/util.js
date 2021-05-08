const u = require('../util')

const tape = require('tape')

tape('set, get, prefix', function (t) {
  const o = {}
  u.set(o, ['foo', 'bar', 'baz'], 24)

  t.equal(u.get(o, ['foo', 'bar', 'baz']), 24)

  t.deepEqual(o, { foo: { bar: { baz: 24 } } })

  t.notOk(u.prefix(o, ['foo', 'baz']))

  t.notOk(u.prefix(o, ['foo']))

  t.notOk(u.prefix(o, ['blah']))

  t.end()
})

tape('prefix 0', function (t) {
  t.ok(
    u.prefix({
      foo: true
    }, ['foo', 'bar'])
  )

  t.end()
})
