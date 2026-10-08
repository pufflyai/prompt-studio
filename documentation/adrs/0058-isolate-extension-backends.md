# ADR: Isolate extension backends in their own processes

Proposed: 2026-10-06

## Status

Proposed. Not implemented. PS-525 builds it. Until then, an installed extension has the access of the user's account.

## Context

MISSION.md lists "keeping secrets away from tools and limiting what a tool may touch" as core work, and expects people to install tools that others built.

Today the host `import()`s every enabled extension entry into the API process (`packages/pstdio-extensions/src/runtime/loader.ts`, called from `packages/pstdio-api/src/features/extensions/extension-runtime.ts` and `project-extension-runtime-sources.ts`). Extension code shares the process with the host, so it can:

- read `process.env`, including provider keys such as `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` from the shell that started Prompt Studio;
- read the connection secret files under the storage root (ADR 0034);
- read `$PSTDIO_HOME/runtime.json` and use the runtime token;
- open the PGlite database and the log files;
- call other extensions' modules and host internals.

The extension context (`ctx`) never hands out a secret value or reference, but nothing stops code from going around it. A community extension, or a compromised npm dependency of one, can read every stored secret and send it out. The host cannot stop or detect this. The audit in PS-497 (security finding 4) confirmed this.

Some limits already work. Child processes and terminals started through `ctx` get an allowlisted environment (`packages/pstdio-extensions/src/runtime/process-environment.ts`). Connection requests pin the base URL and block redirects (`extension-connection-request-service.ts`). Webviews run in sandboxed iframes and can only call the bridge capabilities they declare.

## Decision

1. Each enabled extension backend runs in its own operating system process: one Bun subprocess per installed source version. The API process never imports extension entry code.
2. The process starts with the allowlisted environment that extension child processes already get. It has no provider keys, no registry tokens, and no `PSTDIO_API_TOKEN`.
3. The host exposes the extension context over a narrow message channel. Every `ctx` operation is a request that the host checks and runs. Connection secrets stay in the host: the extension names a connection and the host makes the request. The extension never receives the runtime token or a secret reference.
4. The extension process gets no access to `$PSTDIO_HOME`, which holds secrets, `runtime.json`, the database, and logs. A separate process alone does not enforce this, because the same OS user can read those files. Each platform needs an OS sandbox (for example a macOS sandbox profile, Linux Landlock or bubblewrap, a Windows AppContainer). The first milestone ships process separation, the filtered environment, and the message channel. It removes access to host memory, environment keys, and other extensions. OS sandboxes follow per platform, and the docs say which platforms have one.
5. Reload restarts the extension process instead of importing a new module identity into the host.
6. A harness extension whose agent CLI needs provider keys gets them only through a declared capability that a person approves. The exact shape is open (see below).
7. Changes to `ctx` that refuse something extensions did before follow deprecate-first, as described in [API versioning](../references/extensions/0014-api-versioning.md). New calls are added next to old ones, and removals ship together in one breaking release.
8. Until this ships, the docs and the install UI say plainly that installing an extension gives it the access of your user account. ADR 0034 no longer claims that extension code cannot read secret bytes.

## Consequences

- A malicious or compromised extension can no longer read host memory, the host environment, or other extensions' state. Once an OS sandbox exists on a platform, it also cannot read the Prompt Studio home folder there.
- Each enabled extension costs a process and its memory. Each `ctx` call crosses a process boundary, which adds latency.
- Values passed through `ctx` must be serializable. An extension that passes functions or shares objects with the host must change.
- Reload becomes simpler: a new process replaces the old one, so the host no longer needs temporary import contexts to get fresh module identities.
- Harness extensions that pass the full host environment to their agent CLI today (`extensions/harness-codex/src/spawn.ts`) lose the keys they relied on until the capability in point 6 exists.

## Alternatives considered

- **Worker threads.** Workers share the process environment, file access, and OS identity with the host. They do not keep secrets away from extension code. Rejected.
- **`node:vm`, ShadowRealm, or other in-process sandboxes.** None of these is a security boundary for code that can import Node and Bun built-ins. Rejected.
- **A permission manifest without isolation.** The host cannot enforce declared permissions on code that runs in its own process. Rejected.
- **WebAssembly components.** They give strong isolation, but extensions are TypeScript packages with npm dependencies, and that toolchain is not ready. Rejected for now.

## Open questions

- Startup time and memory budget per extension process.
- Which OS sandbox to use on each platform, and what each one can enforce.
- How a harness extension asks for provider keys, and who approves it.
- Whether an agent session may approve that request. This depends on the scoped agent token decision in PS-503 (item F).
