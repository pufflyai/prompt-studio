# Package Boundaries

Prompt Studio keeps package ownership explicit so shared packages do not absorb
app, runtime, or packaging concerns. The source of truth for mechanical rules is
`scripts/verify/verify-boundaries.ts`, with the layer map and rule tables in
`scripts/verify/boundary-rules.ts`; update this document with any intentional
layer-map change.

Cross-package native editor integration tests live in `packages/e2e`. They may
start the real `pstdio-api/app` host and use the public `@pstdio/workbench` session
API. The workbench package itself does not depend on the API host.

## Layers

1. **Contracts and utilities**
   `pstdio-sync-contracts` defines private, versioned synchronization wire schemas,
   fingerprint validation, compatibility checks, and proposed authoring inputs.
   Its main export depends only on Zod and Web Crypto. Its separate `./conformance`
   export is test-only and uses development dependencies for PGlite, PostgreSQL,
   Yjs, and S3 test storage. It imports no host, SDK, UI, database implementation,
   or provider code. Its consumers, such as `pstdio-sync`, `pstdio-db`,
   `pstdio-api`, `pstdio-relay`, and `pstdio-account-manager`, declare their own
   dependency and layer-map edge. `pstdio-api-contracts`
   consumes its identity and exact-target schemas for local environment bindings;
   it adds no host or provider dependency to the synchronization package.

   `pstdio-api-contracts`, `pstdio-file-types`, `pstdio-paths`,
   `pstdio-logging`, `pstdio-scheduler`, `pstdio-wt`, `pstdio-db`, and
   `pstdio-storage` define stable contracts, file-type metadata, paths, logging,
   scheduling, git, persistence, and filesystem storage primitives.
   `pstdio-storage` reuses asset reference types from `pstdio-sync-contracts`
   and does not depend on `pstdio-db`. They do not
   depend on SDK, UI, workbench, dashboard, or API host packages.
   `pstdio-db` also consumes synchronization contracts for the durable extension
   journal and accepted state. It does not import the test-only conformance entry.
   The private `pstdio-sync` package owns the production, runtime-neutral record
   and text engines. Its root entry owns shared storage ports; records, text,
   transient presence, encryption and relay have separate entry points. Module
   dependency checks keep text and presence independent of host and editor code.
   The six exports are module contracts, not individual internal file exports.
   It accepts storage adapters; `pstdio-db` supplies the durable local adapter.
   [Sync modules](0026-synchronization-contracts.md#sync-modules) defines each owner.
   Its real-file integration tests declare `pstdio-storage` as a development
   dependency to verify immutable asset gates; database runtime code does not import it.
   Its production-relay conformance tests also declare `pstdio-relay` as a development
   dependency. That edge is confined to test fixtures; local database runtime code
   does not open PostgreSQL relay storage.

   The private `pstdio-diagnostics` package owns the bounded performance capture,
   recording and evidence summaries shared by desktop and benchmark drivers. It
   depends only on payload contracts. Callers supply native process observations;
   it imports no Electron, UI, database or client code. Desktop, CLI and E2E
   declare their own dependency on it. Native sampling stays in the host.

   The private `pstdio-benchmarks` package owns benchmark measurements, suite membership,
   sampling, budget policy and shared browser helpers. It has no workspace dependencies.
   Packages with benchmarks declare it as a development dependency. `pstdio-scripts`
   also declares it as a development dependency so priority dispatch and CI coverage
   use the same suite registry. Production entry points do not import it. Its root
   export provides shared tooling; the writer-only entry avoids loading other helpers.

   `storage-scale-fixture` is a private test utility with no workspace dependencies.
   The scale benchmarks in `pstdio-sync`, `pstdio-db` and `e2e` declare it as a
   development dependency. Production entry points do not import it. Its shared
   generator keeps the same workload across layer and compiled-runtime diagnostics.

2. **Public authoring SDK**
   `@pstdio/sdk` exposes extension and client authoring APIs. Runtime or host
   contracts shared with the API live below it in `pstdio-api-contracts`, not in
   API packages. The SDK and workbench declare `pstdio-sync-contracts` as a build
   dependency and inline its types and schemas into their public packages.
   Workbench bundles `pstdio-sync/text` for its browser replica. It is a private
   build dependency and is inlined into runtime and type output.
   The SDK's in-memory test storage also bundles `pstdio-sync`, so extension tests
   use the same grouped-write and conflict rules as the durable host.

3. **Extension runtime**
   `pstdio-extensions` owns extension discovery, metadata normalization, bridge
   contracts, and package artifacts. It must not depend on `@pstdio/workbench`;
   workbench adapters for extension metadata belong in `@pstdio/workbench`.

   The private `pstdio-psx` service consumes the runtime's distribution subpath
   for package validation. It owns PostgreSQL release metadata and S3 package
   storage. It does not import API host packages. E2E fixtures drive its production
   image through HTTP to check delivery to a packaged host.

4. **API host**
   `pstdio-api-runtime-host` and `pstdio-api` own runtime execution and HTTP/API
   orchestration. They consume contracts and extension runtime packages, but they
   do not import public SDK authoring-only types. API integration tests declare
   `@pstdio/sdk` as a development dependency to verify the public HTTP client
   against the real routes. Production API code does not import the SDK.

   Host tests use fake harnesses, such as the one from
   `writeProvisionHarnessExtension` or `workbench-fixture`. They never load the
   real harness extensions. Each harness tests its own process handling, and the
   `harness_cli_support` job tests it against the real CLI.

   A host package that loads another workspace package from source in its tests
   declares it as a development dependency, without importing it. Pull request
   CI then runs those tests when the loaded package changes. `pstdio-api`
   declares `extension-lab`, `pstdio-base-themes`, `pstdio-planner`,
   `pstdio-skills` and `workbench-fixture`. `pstdio-extensions` declares
   `extension-lab`. `pstdio-extension-testbench` declares `pstdio-base-themes`
   and `pstdio-planner`.

5. **Primitive UI**
   `@pstdio/ui` owns reusable React primitives, visual components, theme tokens,
   editor widgets, and terminal-specific React UI through its `./terminal`
   subpath. UI packages consume public terminal contracts through `@pstdio/sdk`
   and bundle shared table field helpers from `pstdio-api-contracts` rather than
   depending on deprecated SDK host helpers. Its private `/collections` entry groups pure
   table and history helpers without importing the Bun host kernel. They must not own router wiring, React Query fetching policy, dashboard
   project/repo concepts, or host persistence policy.

6. **Workbench**
   `@pstdio/workbench` owns workbench core contracts, layout, renderers, storage
   integration, and adapters from extension metadata into workbench modules. It is
   published to npm as a self-contained bundle (its private workspace deps,
   `pstdio-extensions`, `pstdio-api-contracts`, and `pstdio-sync-contracts`, are inlined at build time). Its
   core API must not import `@pstdio/ui`, including type-only imports.

7. **Product apps and tests**
   `pstdio-dashboard`, `pstdio-extension-testbench`, extensions, clients, and
   `e2e` compose lower layers into product workflows. They must import workspace
   packages through declared package dependencies and package exports.

   The private `@pstdio/desktop` client may consume the public runtime lifecycle
   subpath from `pstdio`, path/logging utilities, and `@pstdio/ui`. It shares
   local performance payload schemas and extension webview URL grammar with the
   dashboard and API through `pstdio-api-contracts`. These contracts keep host
   validation and attribution consistent without importing host services. It must not
   import API domain services, database packages, or another client.
   Its packaged Electron tests declare `workbench-fixture` as a development
   dependency and resolve its package root for installation through the public
   extension API. The fixture is not part of the desktop runtime bundle.

   `e2e` declares the extensions and `workbench-fixture` it installs at runtime,
   and the `pstdio-dashboard` it builds and serves, as development dependencies. It
   does not import them. The declarations let the
   package graph treat a change to one of them as an e2e change. A scoped pull
   request then only lints the e2e package. The e2e jobs run in the full CI stage
   on `main`, or on a pull request labeled `ci:full`; see
   [CI scope](../../requirements/platform/0001-cross-platform-support.md#ci-scope).

   The private `canvas-tests` package owns component browser interactions and
   their Canvas servers. It declares `@pstdio/ui`, `@pstdio/workbench`, and
   `pstdio-dashboard` as development dependencies because it loads their stories.
   Story sources stay with those owners. It does not depend on the API, database,
   CLI, or `e2e`. It uses `pstdio-benchmarks` for startup measurements and sample counts.
   App E2E never starts or builds Canvas.

   `e2e` and `@pstdio/desktop` declare the private `pstdio-scripts` workspace as a
   development dependency. Their Playwright configs use its `./test-quarantine`
   export to share registry selection and report metadata. Product runtime code
   does not import this test helper.

8. **Packaging glue**
   `pstdio` may include generated packaging glue for compiled runtime artifacts.
   The CLI consumes runtime and capability contracts directly from
   `pstdio-api-contracts`, rather than deprecated SDK host exports.
   The host embeds the default extension catalog as data. Extension source is fetched
   from each entry's pinned Git origin and is not embedded in the host binary.
   Cross-package relative imports are only allowed for the
   generated embed manifest allowlist enforced by the boundary checker.

The API declares Notes and Planner as development dependencies for the isolated
checkpoint save-handler proof. Their source handlers are test inputs, not runtime
imports. This lets the package graph select that proof when a handler changes.

## Services and infrastructure

`services/` holds the code of deployable services: the relay, the account
manager, and the telemetry library they share. The relay and the account
manager each keep their source, migrations, and Dockerfiles in their own
folder. `infra/` holds only deployment and environment setup, such as Docker
Compose files and the reusable DigitalOcean Terraform module in `infra/terraform/`. Prompt Studio's own environments and secrets live in a separate repository. The relay's test and local Compose files live in `infra/relay/`.
`infra/local/` is the local development stack and the example extensions it
installs. Service code does not belong in `infra/`.

## Shared relay

The private `pstdio-relay` workspace lives under `services/relay/`. It is a separate
service, not part of the local API host or the CLI bundle. It consumes the shared diagnostic adapter, the private
`pstdio-sync` record/branch rules and `pstdio-sync-contracts` wire schemas, including the
blind sync protocol in `src/protocol/`. Its production
access verification uses only the database-free `pstdio-account-manager/access` entry;
the relay receives public issuer/audience/JWKS trust, without the manager database role, signing secret or device credentials. Isolated integration fixtures may
use the manager's operator exports to create disposable accounts and devices. Production
modules never import the test-only conformance export. It must not import the API
host, UI, clients, database implementation, or prototype. PostgreSQL persistence
belongs to the relay; the real local adapter belongs to `pstdio-db`.
See the [relay development guide](../../guides/development/0006-relay.md)
for isolated storage fixtures and container checks.

## Service diagnostics

The private `pstdio-service-telemetry` workspace under `services/telemetry/` has no
workspace dependencies. Manager and relay use it to send fixed diagnostic codes
with deployment tags to the selected EU destination. It never consumes content,
authentication material or local host APIs. It is excluded from the CLI bundle.
See [service diagnostics](../../guides/development/0010-service-diagnostics.md).

## Account authority

The private `pstdio-account-manager` workspace lives under `services/account-manager/`.
It consumes the shared diagnostic adapter and the merged `pstdio-sync-contracts` identity and canonical JSON
contracts. It owns a separate private PostgreSQL database/role and imports no
relay content implementation, local API host, SDK, UI, client or extension code.
It is not part of the CLI bundle. Its authenticated HTTP service and the relay's
access check must preserve that authority boundary. See the
[account authority guide](../../guides/development/0007-account-manager.md) and
[ADR 0076](../../adrs/0076-separate-account-authority-from-content.md).

## Rules

- No workspace package cycles.
- No cross-package relative imports except explicit generated packaging
  allowlists.
- No imports from `clients/*`, by relative path or by package name.
- tsconfig `paths`, including inherited ones, stay inside the package. A non-extension package may map a
  declared workspace dependency to its source (the SDK and workbench builds bundle
  their private dependencies). Extensions may not map anything outside their
  package, so they type-check against the released SDK they declare.
- Every layer-map allowance matches a declared dependency. Remove an allowance
  when the package stops declaring it.
- Private packages have at most two `exports` entries. `pstdio-api`,
  `pstdio-api-contracts`, and `pstdio-extensions` have frozen higher limits. The
  check fails when a limit is above the current count, so a limit only goes down.
- `@pstdio/workbench` `src/core` imports no `@pstdio/ui` specifier, including
  subpaths and type-only imports.
- Every workspace package import must be declared in the importer's
  `package.json`.
- Extensions consume host APIs only through `@pstdio/sdk` and `@pstdio/ui`. Additional workspace dependencies must be listed explicitly in the layer map.
- The private `motion-lab` extension reads studies from `design/motion/studies` as project content. Its shared scene kit and Remotion Player belong to the extension. Runtime scenes reuse the preview’s React, Chakra, Remotion and shared UI modules. Production UI and host packages do not depend on Motion Lab or Remotion.
  Its TypeScript paths resolve study imports through Motion Lab's installed dependencies, so type checking uses the same published UI as the preview.
- Extensions pin `@pstdio/ui` to an exact published version. The pin does not have to match an unreleased workspace version; extension dependency updates ship after the public package release.
- Extensions resolve `@pstdio/sdk` and `@pstdio/ui` from npm, including development dependencies. `bunfig.toml` disables automatic workspace links for plain version ranges; explicit `workspace:` links in core packages still work. `verify:boundaries` checks `bun.lock` for registry entries under every extension in `extensions/`, `.pstdio/extensions/`, and `infra/local/extensions/`. A matching local version must never hide an unreleased API.
- `@pstdio/ui` may not import or declare router or React Query dependencies.
- E2E tests use package exports and declare every workspace dependency they
  import.

The database uses the contract-layer `ResourceRef` type for persisted resource values. The UI library imports the SDK's public serializable control types and adds separate React-node and browser-file variants. These are type dependencies; the UI library still owns no routing, query, or extension-host policy. The SDK declaration rollup includes the private contract types, so installed UI declarations resolve through public packages.

## Canvas authoring tooling

The private `@pstdio/canvas` package owns preview composition, documentation blocks, and source indexing. UI packages and repository preview builds may use it as development tooling; it has no application-layer dependencies. Published extensions may use its type-only imports inside colocated `.canvas.tsx` examples without declaring a runtime dependency. Runtime imports still require a declared, allowed dependency. Published extension type checks exclude `.canvas.tsx` examples; the repository Canvas type-check command checks them through each owner’s `tsconfig.canvas.json` (or the UI examples configuration). This keeps repository examples independent of extension installation and published SDK/UI versions.
