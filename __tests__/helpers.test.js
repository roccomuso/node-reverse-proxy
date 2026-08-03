const test = require('tape')
const { getHostname, findRoute } = require('../index')

test('getHostname strips the port from the Host header', (t) => {
  t.equal(getHostname({ headers: { host: 'example.com:8080' } }), 'example.com')
  t.end()
})

test('getHostname lowercases the hostname', (t) => {
  t.equal(getHostname({ headers: { host: 'Example.COM' } }), 'example.com')
  t.end()
})

test('getHostname returns an empty string when there is no Host header', (t) => {
  t.equal(getHostname({ headers: {} }), '')
  t.end()
})

test('findRoute returns the route matching the hostname', (t) => {
  const routes = [
    { host: 'my-site-a.com', target: 'http://127.0.0.1:3001' },
    { host: 'my-other-site.com', target: 'http://127.0.0.1:3002' }
  ]
  t.deepEqual(findRoute(routes, 'my-other-site.com'), routes[1])
  t.end()
})

test('findRoute returns undefined when no route matches', (t) => {
  const routes = [{ host: 'my-site-a.com', target: 'http://127.0.0.1:3001' }]
  t.equal(findRoute(routes, 'unknown.com'), undefined)
  t.end()
})

test('findRoute matches a wildcard route against any subdomain', (t) => {
  const routes = [{ host: '*.example.com', target: 'http://127.0.0.1:3001' }]
  t.deepEqual(findRoute(routes, 'www.example.com'), routes[0])
  t.deepEqual(findRoute(routes, 'api.example.com'), routes[0])
  t.end()
})

test('findRoute does not match a wildcard route against the bare domain', (t) => {
  const routes = [{ host: '*.example.com', target: 'http://127.0.0.1:3001' }]
  t.equal(findRoute(routes, 'example.com'), undefined)
  t.end()
})

test('findRoute does not match a wildcard route against an unrelated domain', (t) => {
  const routes = [{ host: '*.example.com', target: 'http://127.0.0.1:3001' }]
  t.equal(findRoute(routes, 'www.other.com'), undefined)
  t.end()
})

test('findRoute prefers an exact route over a wildcard one for the bare domain', (t) => {
  const routes = [
    { host: '*.example.com', target: 'http://127.0.0.1:3001' },
    { host: 'example.com', target: 'http://127.0.0.1:3002' }
  ]
  t.deepEqual(findRoute(routes, 'example.com'), routes[1])
  t.end()
})
