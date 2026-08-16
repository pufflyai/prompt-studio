# ADR: Temporary Non-Blocking Bun Shutdown

## Status

Temporary workaround for Bun 1.3.13. Remove it when a stable Bun release lets `Bun.Server.stop(true)` finish while supported browsers hold long-lived connections open.

## Ideal design

Runtime shutdown should await `server.stop(true)`, then close the application and remove its runtime descriptor. When shutdown resolves, both the transport and every application-owned resource should be closed.

## External limitation

Bun can leave the promise returned by `server.stop(true)` pending while Firefox holds the dashboard sync stream open. Prompt Studio cannot complete or cancel that Bun-owned promise. Awaiting it blocks application cleanup, leaves the runtime descriptor behind, and prevents `pstdio close` from finishing.

## Decision

Start `server.stop(true)` without awaiting its promise. Continue by closing the application, removing the runtime descriptor, and exiting the owning process. Process exit closes any sockets that Bun has not finished closing.

The shutdown unit test uses a server whose stop promise never resolves. The CLI browser test keeps the dashboard sync stream open in Firefox while `pstdio close` completes.

## Trade-offs

Shutdown completion no longer proves that Bun's transport promise settled. It relies on the runtime process exiting immediately after Prompt Studio releases its own resources. In return, application cleanup and descriptor removal cannot be blocked by a browser connection owned by Bun.

## Isolation

The workaround is contained in the `serveApp` shutdown adapter. It adds no public option, timeout, stored state, or alternate shutdown path. Application cleanup and runtime ownership rules remain unchanged.

## Removal

When Prompt Studio upgrades to a stable Bun release that may contain the fix:

1. Change the focused shutdown test so the server stop promise resolves only after its active connection closes.
2. Await `server.stop(true)` again in `serveApp`.
3. Run the close CLI tests with the sync stream open in every supported browser.
4. Run packaged verification on every supported platform.
5. Remove this ADR when those checks pass without the non-blocking call.
