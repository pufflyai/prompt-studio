# ADR: Isolate extension backends in their own processes

Proposed: 2026-10-06

Status: Accepted. Process separation is implemented under PS-525; OS sandboxes (point 4) remain open. Every extension backend runs in a private worker process, which the packaged CLI starts (`packages/pstdio-extensions/src/runtime/backend-process`). The API process never imports an extension entry. Its context calls reach only host members the host allowlists. Every contribution kind runs there: commands, middleware, private handlers, hooks, harnesses, workspace types, text sources and resource hierarchy providers. Handlers can pass callbacks to host APIs. They can use the handles, promises and streams the host returns, which stay valid while either side holds them. Every `ctx` member is available, including `ctx.terminal` and `ctx.process.spawn`, whose handles the worker returns at once and connects to the host's session or child when it opens.

Workers start lazily. A short-lived worker reads an entry's definition once per prepared revision, and the host stores it with the revision (ADR 0147), so a host start with stored definitions starts no worker until a handler runs.

Point 2 changed for compatibility. The worker gets the host environment without Prompt Studio's credentials (`PSTDIO_*` names containing `TOKEN`, `SECRET`, `KEY`, `PASSWORD` or `CREDENTIAL`, such as its API token) and the registry credentials (`NPM_CONFIG_*`, `NPM_TOKEN`, `NPM_AUTH_TOKEN`, `NODE_AUTH_TOKEN`, `BUN_AUTH_TOKEN`). Settings such as `PSTDIO_HOME` and `PSTDIO_SESSION_ID` stay, because extensions and the agents they start rely on them. Harnesses still read provider keys, proxies and CA settings from `process.env` and start their CLIs themselves. Core health takes priority over secret isolation, so the only runtime must not break them. Provider keys in the starting environment are therefore visible to backend code, as they were in the API process. Children started through `ctx.process` and `ctx.terminal` keep the allowlisted environment.

Point 6 has its first shape: a package lists host variable names in `pstdio.processEnvironment`, a person allows them per project and source in the extension details or with `pst extensions permissions`, and `ctx.process` adds a granted value only to the child that names it in `envFromHost`. No `ctx` API returns the value, but the extension chooses the command, so allowing a name lets it use the value. Because the worker environment carries the same value, a grant decides which children receive it, not whether backend code can read it. Narrowing the worker environment to the allowlist is possible once harnesses use `envFromHost`.

One worker serves every project that enables the same content revision. It therefore receives the invocation ids of all of them; that is no more than in-process code reached, since it could keep another project's `ctx`. Backend code keeps the user's OS account and file access until a platform sandbox ships, so it can still read `$PSTDIO_HOME`. Preparation bundles each entry in a separate child process with the same allowlisted environment, so bundler macros never run in the host (PS-1296).

## Context

[The mission](../guidance/0001-mission.md) lists "keeping secrets away from tools and limiting what a tool may touch" as core work, and expects people to install tools that others built.

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
