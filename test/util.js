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

tape('errorAsStreamOrCb async', t => {
  t.plan(1)
  u.errorAsStreamOrCb('async', new Error('foo'), (err) => {
    t.equal(err.message, 'foo')
  })
})

tape('errorAsStreamOrCb source', t => {
  t.plan(1)
  const source = u.errorAsStreamOrCb('source', new Error('foo'), null)
  t.equals(typeof source, 'function')
})

tape('errorAsStreamOrCb sink', t => {
  t.plan(1)
  const sink = u.errorAsStreamOrCb('sink', new Error('foo'), null)
  t.equals(typeof sink, 'function')
})

tape('errorAsStreamOrCb duplex', t => {
  t.plan(3)
  const duplex = u.errorAsStreamOrCb('duplex', new Error('foo'), null)
  t.equals(typeof duplex, 'object')
  t.equals(typeof duplex.source, 'function')
  t.equals(typeof duplex.sink, 'function')
})
