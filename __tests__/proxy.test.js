const http = require('node:http')
const test = require('tape')
const { createServer } = require('../index')

// Starts a plain HTTP server on an ephemeral port that always replies with `body`.
function startBackend (body) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => res.end(body))
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

// Reserves and immediately frees a port, so requests to it reliably fail
// with ECONNREFUSED (simulating a backend that's down).
function getUnusedPort () {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

function request (port, host) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/', headers: { Host: host } },
      (res) => {
        let body = ''
        res.on('data', (chunk) => { body += chunk })
        res.on('end', () => resolve({ statusCode: res.statusCode, body }))
      }
    )
    req.on('error', reject)
    req.end()
  })
}

let backendA
let backendB
let downPort
let proxyServer
let proxyPort

test('setup', async (t) => {
  backendA = await startBackend('A')
  backendB = await startBackend('B')
  downPort = await getUnusedPort()

  const routes = [
    { host: 'my-site-a.com', target: `http://127.0.0.1:${backendA.address().port}` },
    { host: 'my-other-site.com', target: `http://127.0.0.1:${backendB.address().port}` },
    { host: 'down-site.com', target: `http://127.0.0.1:${downPort}` }
  ]

  proxyServer = createServer(routes)
  await new Promise((resolve) => proxyServer.listen(0, '127.0.0.1', resolve))
  proxyPort = proxyServer.address().port
  t.end()
})

test('routes requests to the backend matching the Host header', async (t) => {
  const resA = await request(proxyPort, 'my-site-a.com')
  t.equal(resA.statusCode, 200)
  t.equal(resA.body, 'A')

  const resB = await request(proxyPort, 'my-other-site.com')
  t.equal(resB.statusCode, 200)
  t.equal(resB.body, 'B')
  t.end()
})

test('returns 404 for a host with no matching route', async (t) => {
  const res = await request(proxyPort, 'unknown-host.com')
  t.equal(res.statusCode, 404)
  t.ok(/Nothing found/.test(res.body))
  t.end()
})

test('returns 502 when the target backend is unreachable, without crashing the server', async (t) => {
  const res = await request(proxyPort, 'down-site.com')
  t.equal(res.statusCode, 502)
  t.ok(/Bad gateway/.test(res.body))

  // the proxy must still serve subsequent requests after a backend failure
  const followUp = await request(proxyPort, 'my-site-a.com')
  t.equal(followUp.statusCode, 200)
  t.equal(followUp.body, 'A')
  t.end()
})

test('teardown', async (t) => {
  await Promise.all([
    new Promise((resolve) => proxyServer.close(resolve)),
    new Promise((resolve) => backendA.close(resolve)),
    new Promise((resolve) => backendB.close(resolve))
  ])
  t.end()
})
