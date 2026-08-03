# vhost-reverse-proxy

A minimal Node.js library for a domain-based (virtual host) reverse HTTP proxy — a small, programmable stand-in for nginx's `server_name` -> upstream routing.

## Features

- Domain-based routing (HTTP and WebSocket) to any local or remote host/port
- 502 responses (instead of a crash) when a backend is down or unreachable
- 404 for unmatched hosts
- Routes can be passed upfront via config, or added/removed at runtime
- No side effects on `require` — you control when (and whether) it listens

## Install

```sh
yarn add vhost-reverse-proxy
```

## Usage

```js
const createProxy = require('vhost-reverse-proxy')

const proxy = createProxy({
  routes: [
    { host: 'my-site-a.com', target: 'http://127.0.0.1:3001' },
    { host: 'my-other-site.com', target: 'http://127.0.0.1:3002' }
  ]
})

proxy.listen(8080, () => {
  console.log('proxy listening on port 8080')
})
```

`createProxy` is also available as a named export: `const { createProxy } = require('vhost-reverse-proxy')`.

## API

### `createProxy(config?)`

Creates a proxy instance. Nothing is bound to a port until you call `.listen()`.

`config` (all fields optional):

| field          | type      | default                          | description                                                        |
|----------------|-----------|-----------------------------------|---------------------------------------------------------------------|
| `routes`       | `Array`   | `[]`                              | `{ host, target }` domain -> target mappings                       |
| `port`         | `number`  | `process.env.PORT` or `80`        | default port used by `.listen()` when called with no argument       |
| `logRequests`  | `boolean` | `false`                           | log every request's headers                                        |
| `silent`       | `boolean` | `false`                           | suppress the per-request match/404/502 console logs                 |

Returns an object with:

- **`listen([port], [callback])`** — start listening (defaults to `config.port`)
- **`close([callback])`** — stop listening
- **`addRoute(host, target)`** — add a route, or update the target if `host` already has one; chainable
- **`removeRoute(host)`** — remove a route; chainable
- **`routes`** — the live routes array (mutate via `addRoute`/`removeRoute` rather than directly)
- **`server`** — the underlying `http.Server`, for anything not covered above
- **`proxy`** — the underlying [`http-proxy`](https://github.com/http-party/node-http-proxy) instance

### Dynamic routing

```js
proxy.addRoute('new-site.com', 'http://127.0.0.1:3003')
proxy.removeRoute('my-site-a.com')
```

## Graceful shutdown

The library never registers process-wide signal handlers on your behalf. Wire up your own, e.g.:

```js
process.on('SIGTERM', () => proxy.close(() => process.exit(0)))
```

## Example

See [`example.js`](./example.js) for a runnable demo:

```sh
PORT=8080 yarn start
```

## Test

```sh
yarn test
```

Runs `standard` (lint) followed by the test suite in `__tests__/` — unit tests for the route-matching helpers, plus integration tests that spin up real backend servers to exercise routing, the 404 path, the 502-on-backend-down path, and the `addRoute`/`removeRoute` API.
