# 0027: Temporary Playwright idle connection expiry

Status: temporary workaround.

## Intended design

API test requests should reuse healthy connections and retire idle connections before the server closes them. Disposing a request context must not leave later tests using an expired connection. Failed mutations must remain failures; they must not be retried automatically.

## External limitation

Playwright 1.60.0 shares HTTP and HTTPS agents across request contexts. Those agents enable keep-alive without an idle timeout, and the public request API does not expose their configuration. Node 24's normal global agent uses a five-second timeout. With a zero agent timeout, its keep-alive hint calculation also fails to apply a positive server hint.

CI run 34584480380, attempt 2, failed a project-creation POST with a socket hang-up after four milliseconds. The server continued serving the following tests. A real request-context regression confirms that Playwright reuses a connection after the server's advertised safe deadline, even across disposed contexts.

## Temporary workaround

Use Bun's version-scoped patch for `playwright-core@1.60.0`. Give its two shared agents the same five-second socket timeout as Node's normal global agent. This lets Node retire idle sockets and apply shorter server hints. It keeps connection reuse for active test traffic. No request retry, browser launch option, or server timeout change is added.

The patch only changes Playwright's test client. Application clients, browser networking, and server request limits stay under their existing owners. The trade-off is maintaining a small dependency patch until upstream supplies bounded idle connection reuse.

## Removal

Remove the patch and its `patchedDependencies` entry when Playwright supplies idle expiry or owns and disposes agents per request context. Run the connection-lifetime regression without the patch and repeat the complete CI workflows before removing it.

## Evidence

- [Node 24 HTTP agent defaults](https://nodejs.org/download/release/v24.16.0/docs/api/http.html#httpglobalagent).
- [Node keep-alive timeout buffer](https://nodejs.org/download/release/v24.16.0/docs/api/http.html#new-agentoptions).
- `packages/e2e/src/scripts/api-request-connection.test.ts` exercises real Node and Playwright requests against an isolated HTTP server.
