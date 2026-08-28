const http = require('http')
const httpProxy = require('http-proxy')
const signale = require('signale')
const treeify = require('treeify')

// Extract the bare hostname (no port) from a request's Host header
function getHostname (req) {
  return (req.headers.host || '').split(':')[0].toLowerCase()
}

// Find the route matching a given hostname. A route host of `*.example.com`
// matches any subdomain (www.example.com, api.example.com, ...) but not the
// bare `example.com` itself — add a separate exact route for that if needed.
function findRoute (routes, hostname) {
  return routes.find((route) => {
    if (route.host.startsWith('*.')) {
      const base = route.host.slice(2)
      return hostname !== base && hostname.endsWith(`.${base}`)
    }
    return route.host === hostname
  })
}

// Without an 'error' listener, http-proxy rethrows and crashes the whole
// process whenever a backend is down or unreachable. Handle it for both
// plain HTTP (res is a ServerResponse) and WebSocket (res is a raw Socket).
function handleProxyError (err, req, res, silent) {
  if (!silent) signale.error(`Proxy error for ${req.headers.host}: ${err.message}`)
  if (typeof res.writeHead === 'function') {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/html' })
      res.end('<h2>Bad gateway</h2>')
    } else if (!res.destroyed) {
      // Headers (and possibly part of the body) were already sent, so we
      // can't write a clean error page without corrupting the response
      // (mismatched Content-Length/chunked framing forces Node to reset
      // the socket, which surfaces to the client as ERR_CONNECTION_RESET).
      // Just end the stream as-is.
      res.end()
    }
  } else if (!res.destroyed) {
    res.destroy()
  }
}

/**
 * Create a domain-based (virtual host) reverse proxy.
 *
 * @param {object} [config]
 * @param {{host: string, target: string}[]} [config.routes] - domain -> target mappings, e.g.
 *   [{ host: 'my-site-a.com', target: 'http://127.0.0.1:3001' }]. A host of `*.example.com`
 *   matches any subdomain but not the bare `example.com` — add that separately if needed.
 * @param {number} [config.port] - default port used by `.listen()` when called with no argument
 *   (falls back to the `PORT` env var, then 80)
 * @param {boolean} [config.logRequests] - log every request's headers (default: false)
 * @param {boolean} [config.silent] - suppress the per-request match/404/502 console logs (default: false)
 */
function createProxy (config = {}) {
  const routes = Array.isArray(config.routes) ? [...config.routes] : []
  const port = config.port || process.env.PORT || 80
  const logRequests = Boolean(config.logRequests)
  const silent = Boolean(config.silent)

  const proxy = httpProxy.createProxyServer({ timeout: 30000, proxyTimeout: 15000 })
  proxy.on('error', (err, req, res) => handleProxyError(err, req, res, silent))

  const server = http.createServer((req, res) => {
    if (logRequests) console.log(treeify.asTree(req.headers, true))

    const route = findRoute(routes, getHostname(req))

    if (!route) {
      if (!silent) signale.error(`404 host not found: ${req.headers.host}`)
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/html')
      res.end('<h2>Nothing found</h2>')
      return
    }

    if (!silent) signale.success(`Matched ${route.host} -> ${route.target}`)
    proxy.web(req, res, { target: route.target })
  })

  // Bound how long a client (including scanners that open a socket and idle)
  // can take to send a request, down from Node's defaults of 60s/300s.
  server.headersTimeout = 20000
  server.requestTimeout = 30000

  // Proxy WebSocket upgrade requests (e.g. socket.io, HMR) using the same routes
  server.on('upgrade', (req, socket, head) => {
    const route = findRoute(routes, getHostname(req))

    if (!route) {
      if (!silent) signale.error(`404 ws host not found: ${req.headers.host}`)
      socket.destroy()
      return
    }

    proxy.ws(req, socket, head, { target: route.target })
  })

  return {
    server,
    proxy,
    routes,

    listen (listenPort = port, callback) {
      return server.listen(listenPort, callback)
    },

    close (callback) {
      return server.close(callback)
    },

    addRoute (host, target) {
      const hostname = host.toLowerCase()
      const existing = routes.find((route) => route.host === hostname)
      if (existing) {
        existing.target = target
      } else {
        routes.push({ host: hostname, target })
      }
      return this
    },

    removeRoute (host) {
      const hostname = host.toLowerCase()
      const index = routes.findIndex((route) => route.host === hostname)
      if (index !== -1) routes.splice(index, 1)
      return this
    }
  }
}

module.exports = createProxy
module.exports.createProxy = createProxy
module.exports.getHostname = getHostname
module.exports.findRoute = findRoute
