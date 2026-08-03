const http = require('http')
const httpProxy = require('http-proxy')
const signale = require('signale')
const connect = require('connect')
const vhost = require('vhost')
const treeify = require('treeify')

const PORT = process.env.PORT || 80

//
// Map each domain to the local server/port it should be routed to,
// just like nginx's server_name -> upstream blocks.
//
const routes = [
  { host: 'my-site-a.com', target: 'http://127.0.0.1:3001' },
  { host: 'my-other-site.com', target: 'http://127.0.0.1:3002' }
]

// Extract the bare hostname (no port) from a request's Host header
function getHostname (req) {
  return (req.headers.host || '').split(':')[0].toLowerCase()
}

// Find the route matching a given hostname
function findRoute (routes, hostname) {
  return routes.find((route) => route.host === hostname)
}

// Without an 'error' listener, http-proxy rethrows and crashes the whole
// process whenever a backend is down or unreachable. Handle it for both
// plain HTTP (res is a ServerResponse) and WebSocket (res is a raw Socket).
function handleProxyError (err, req, res) {
  signale.error(`Proxy error for ${req.headers.host}: ${err.message}`)
  if (typeof res.writeHead === 'function') {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/html' })
    }
    res.end('<h2>Bad gateway</h2>')
  } else if (!res.destroyed) {
    res.destroy()
  }
}

// Build a fully wired reverse-proxy server for the given routes, without
// binding to a port. Kept separate from the listen/signal-handling below so
// it can be reused (e.g. in tests) with different routes and ports.
function createServer (routes) {
  const proxy = httpProxy.createProxyServer({})
  proxy.on('error', handleProxyError)

  const app = connect()

  // Logging middleware
  app.use((req, res, next) => {
    console.log(treeify.asTree(req.headers, true))
    next()
  })

  // Register a vhost middleware per route
  for (const { host, target } of routes) {
    app.use(vhost(host, (req, res) => {
      signale.success(`Matched ${host} -> ${target}`)
      proxy.web(req, res, { target })
    }))
  }

  // 404
  app.use((req, res) => {
    signale.error(`404 host not found: ${req.headers.host}`)
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/html')
    res.end('<h2>Nothing found</h2>')
  })

  const server = http.createServer(app)

  // Proxy WebSocket upgrade requests (e.g. socket.io, HMR) using the same routes
  server.on('upgrade', (req, socket, head) => {
    const hostname = getHostname(req)
    const route = findRoute(routes, hostname)

    if (!route) {
      signale.error(`404 ws host not found: ${req.headers.host}`)
      socket.destroy()
      return
    }

    proxy.ws(req, socket, head, { target: route.target })
  })

  return server
}

module.exports = { createServer, routes, getHostname, findRoute }

if (require.main === module) {
  const server = createServer(routes)

  server.listen(PORT, () => {
    signale.success(`proxy listening on port ${PORT}`)
  })

  const shutdown = () => {
    signale.info('shutting down proxy...')
    server.close(() => process.exit(0))
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
