
const permissions = require('../permissions')

const tape = require('tape')

tape('allowlist', function (t) {
  const p = permissions()

  p({ allow: ['foo', 'bar', 'baz'] })

  if (process.env.TEST_VERBOSE) console.log(p)

  t.ifError(p.test('foo'))
  t.ifError(p.test('bar'))
  t.ifError(p.test('baz'))

  t.ok(p.test('xxx'))
  t.ok(p.test('whatever'))

  t.end()
})

tape('nested allowlist', function (t) {
  const p = permissions()

  p({ allow: ['foo'] })

  t.ifError(p.test(['foo', 'quxx']))
  t.end()
})

tape('nested blocklist', function (t) {
  const p = permissions()

  p({ deny: ['foo'] })

  t.ok(p.test(['foo', 'quxx']))
  t.end()
})

tape('deep blocklist', function (t) {
  const p = permissions()

  p({ deny: [['foo', 'quxx']] })

  t.ok(p.test(['foo', 'quxx']))
  t.notOk(p.test(['foo', 'bar']))
  t.end()
})

tape('deep blocklist, dotted strings', function (t) {
  const p = permissions()

  p({ deny: ['foo.quxx'] })

  t.ok(p.test(['foo', 'quxx']))
  t.notOk(p.test(['foo', 'bar']))
  t.end()
})

tape('matches', function (t) {
  const p = permissions()

  p({ allow: ['bar', 'foo'], deny: ['foo.quxx'] })

  function allowed (path) {
    t.notOk(p.test(path), 'allowed:' + path)
  }

  function denied (path) {
    t.ok(p.test(path), 'denied:' + path)
  }

  denied(['foo', 'quxx'])
  allowed(['foo', 'bar'])

  allowed(['bar'])
  allowed(['bar', 'foo'])

  t.end()
})
