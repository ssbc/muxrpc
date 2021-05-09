const tape = require('tape')
const m = require('../util')
const mount = m.mount
const unmount = m.unmount

tape('mount manifest at root', (t) => {
  const manf = {}

  mount(manf, [], { thing: 'async' })

  t.deepEqual(manf, { thing: 'async' })

  mount(manf, ['foo'], { thing: 'async' })

  t.deepEqual(manf, { thing: 'async', foo: { thing: 'async' } })

  t.end()
})

tape('without mount without path should throw', (t) => {
  t.throws(() => {
    mount({}, { thing: 'async' })
  })

  t.end()
})

tape('unmount', (t) => {
  const manf = {}

  mount(manf, ['foo'], { one: 'async' })
  mount(manf, ['bar'], { two: 'async' })

  t.deepEqual(manf, { foo: { one: 'async' }, bar: { two: 'async' } })

  unmount(manf, ['foo'])

  t.deepEqual(manf, { bar: { two: 'async' } })

  t.end()
})

tape('deep unmount', (t) => {
  const manf = {}

  mount(manf, ['foo'], { one: 'async' })
  mount(manf, ['foo', 'bar'], { two: 'async' })

  t.deepEqual(manf, { foo: { one: 'async', bar: { two: 'async' } } })

  unmount(manf, ['foo', 'bar'])

  t.deepEqual(manf, { foo: { one: 'async' } })

  t.end()
})

tape('deep unmount 2', (t) => {
  const manf = {}

  m.mount(manf, ['foo', 'bar'], { two: 'async' })

  t.deepEqual(manf, { foo: { bar: { two: 'async' } } })

  m.unmount(manf, ['foo', 'bar'])

  t.deepEqual(manf, {})

  t.end()
})
