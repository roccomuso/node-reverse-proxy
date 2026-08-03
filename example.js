const signale = require('signale')
const createProxy = require('./index')

const proxy = createProxy({
  routes: [
    { host: 'my-site-a.com', target: 'http://127.0.0.1:3001' },
    { host: 'my-other-site.com', target: 'http://127.0.0.1:3002' }
  ],
  logRequests: true
})

const server = proxy.listen(process.env.PORT || 80, () => {
  signale.success(`proxy listening on port ${server.address().port}`)
})

const shutdown = () => {
  signale.info('shutting down proxy...')
  proxy.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
