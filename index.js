const http = require('http')
const httpProxy = require('http-proxy')
const signale = require('signale')
const connect = require('connect')
const vhost = require('vhost')
const treeify = require('treeify')

//
// Create a proxy server with custom application logic
//
const proxy = httpProxy.createProxyServer({})
const app = connect()

//
// Create your custom server and just call `proxy.web()` to proxy
// a web request to the target passed in the options
// also you can use `proxy.ws()` to proxy a websockets request
//

// Logging middleware
app.use((req, res, next) => {
  console.log(treeify.asTree(req.headers, true))
  next()
})

// domain A
app.use(vhost('my-site-a.com', (req, res) => {
  signale.success('Matched my-site-a.com')
  proxy.web(req, res, { target: 'http://127.0.0.1:3001' })
}))

// domain B
app.use(vhost('my-other-site.com', (req, res) => {
  signale.success('Matched my-other-site.com')
  proxy.web(req, res, { target: 'http://127.0.0.1:3002' })
}))

// 404
app.use((req, res) => {
  signale.error(`404 host not found: ${req.host}`)
  res.setHeader('Content-Type', 'text/html')
  res.end('<h2>Nothing found</h2>')
})

const server = http.createServer(app)
signale.success('proxy listening on port 80')
server.listen(80)

