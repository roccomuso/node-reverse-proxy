# vhost-reverse-proxy

A minimal Node.js reverse HTTP proxy that routes requests to different local servers based on the domain (virtual host) in the request — a small, hackable stand-in for nginx's `server_name` -> upstream routing.

## Features

- Domain-based routing (HTTP and WebSocket) to any local host/port
- 502 responses (instead of a crash) when a backend is down or unreachable
- 404 for unmatched hosts
- Configurable listen port via `PORT`
- Graceful shutdown on `SIGINT` / `SIGTERM`

## Install

```sh
yarn install
```

## Configure routes

Edit the `routes` array in `index.js` to map each domain to the local server it should be proxied to:

```js
const routes = [
  { host: 'my-site-a.com', target: 'http://127.0.0.1:3001' },
  { host: 'my-other-site.com', target: 'http://127.0.0.1:3002' }
]
```

## Run

```sh
yarn start
```

Listens on port `80` by default. Since binding to port 80 requires elevated privileges on most systems, override it with the `PORT` environment variable, e.g.:

```sh
PORT=8080 yarn start
```

## Test

```sh
yarn test
```

Runs `standard` (lint) followed by the test suite in `__tests__/` (unit tests for the route-matching helpers, plus integration tests that spin up real backend servers to exercise routing, the 404 path, and the 502-on-backend-down path).
