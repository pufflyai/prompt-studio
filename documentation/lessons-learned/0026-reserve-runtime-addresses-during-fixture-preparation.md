# Reserve runtime addresses during fixture preparation

## When to use

- A test chooses a runtime address before starting another local service.
- Fixture preparation allocates ports automatically, such as a package registry on port zero.

## Failure

- Closing a probe releases its address. A later local service can allocate that same port before the runtime binds it.
- A failed runtime bind prevents the selected browser cases from executing. A later passing run does not explain the first failure.

## Prevention

- Hold the runtime's address while preparing owned services that allocate ports. Release that reservation immediately before starting the runtime.
- Close the reservation when preparation fails. Leave foreign listeners alone and fail promptly on an occupied address.
- Readiness must require the actual runtime's completion signal; an open reservation socket is not readiness.
- This protects the owned preparation window. It does not make the later handoff atomic against unrelated processes.

## Evidence

- [UI registry preparation](../../packages/e2e/src/scripts/prepare-ui-registry.ts) and its [real-socket regression](../../packages/e2e/src/scripts/prepare-ui-registry.p0.test.ts).
- [UI fixture readiness](../../packages/e2e/src/serve-web-server.ts) waits for runtime and tool setup completion rather than an open TCP port.
