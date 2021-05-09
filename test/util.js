const tape = require('tape')
const u = require('../util')

tape('set, get, prefix', (t) => {
  const o = {}
  u.set(o, ['foo', 'bar', 'baz'], 24)

  t.equal(u.get(o, ['foo', 'bar', 'baz']), 24)

  t.deepEqual(o, { foo: { bar: { baz: 24 } } })

  t.notOk(u.prefix(o, ['foo', 'baz']))

  t.notOk(u.prefix(o, ['foo']))

  t.notOk(u.prefix(o, ['blah']))

  t.end()
})

tape('prefix 0', (t) => {
  t.ok(
    u.prefix({
      foo: true
    }, ['foo', 'bar'])
  )

  t.end()
})
