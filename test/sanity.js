const test = require('tap').test

test('Sanity Check', t => {
  let MetadocPlugin = require('../index')

  t.ok(typeof MetadocPlugin === 'function', 'MetadocPlugin class recognized.')
  t.end()
})
