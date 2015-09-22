
var tape = require('tape')
var m = require('../util')
var mount = m.mount
var unmount = m.unmount

tape('mount manifest at root', function (t) {

  var manf = {}

  mount(manf, [], {thing: 'async'})

  t.deepEqual(manf, {thing: 'async'})

  mount(manf, ['foo'], {thing: 'async'})

  t.deepEqual(manf, {thing: 'async', foo: {thing: 'async'}})

  t.end()
})

tape('without mount without path should throw', function (t) {

  t.throws(function () {
    mount({}, {thing: 'async'})
  })

  t.end()
})

tape('unmount', function (t) {
  var manf = {}

  mount(manf, ['foo'], {one: 'async'})
  mount(manf, ['bar'], {two: 'async'})

  t.deepEqual(manf, {foo: {one: 'async'}, bar: {two: 'async'}})

  unmount(manf, ['foo'])

  t.deepEqual(manf, {bar: {two: 'async'}})

  t.end()

})


tape('deep unmount', function (t) {
  var manf = {}

  mount(manf, ['foo'], {one: 'async'})
  mount(manf, ['foo', 'bar'], {two: 'async'})

  t.deepEqual(manf, {foo: {one: 'async', bar: {two: 'async'}}})

  unmount(manf, ['foo', 'bar'])

  t.deepEqual(manf, {foo: {one: 'async'}})

  t.end()

})

tape('deep unmount 2', function (t) {

  var manf = {}

  m.mount(manf, ['foo', 'bar'], {two: 'async'})

  t.deepEqual(manf, {foo: {bar: {two: 'async'}}})

  m.unmount(manf, ['foo', 'bar'])

  t.deepEqual(manf, {})

  t.end()

})

