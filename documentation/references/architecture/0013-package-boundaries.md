# Package Boundaries

Prompt Studio keeps package ownership explicit so shared packages do not absorb
app, runtime, or packaging concerns. The source of truth for mechanical rules is
`scripts/verify/verify-boundaries.ts`, with the layer map and rule tables in
`scripts/verify/boundary-rules.ts`; update this document with any intentional
layer-map change.

## Layers

1. **Contracts and utilities**
   `pstdio-sync-contracts` defines private, versioned synchronization wire schemas,
   fingerprint validation, compatibility checks, and proposed authoring inputs.
   Its main export depends only on Zod and Web Crypto. Its separate `./conformance`
   export is test-only and uses development dependencies for PGlite, PostgreSQL,
   Yjs, and S3 test storage. It imports no host, SDK, UI, database implementation,
   or provider code. Future runtime and relay consumers must declare their own
   dependency and layer-map edge when they integrate it; none is added speculatively.

   `pstdio-api-contracts`, `pstdio-file-types`, `pstdio-paths`,
   `pstdio-logging`, `pstdio-scheduler`, `pstdio-wt`, `pstdio-db`, and
   `pstdio-storage` define stable contracts, file-type metadata, paths, logging,
   scheduling, git, persistence, and filesystem storage primitives.
   `pstdio-storage` does not depend on `pstdio-db`. They do not
   depend on SDK, UI, workbench, dashboard, or API host packages.

2. **Public authoring SDK**
   `@pstdio/sdk` exposes extension and client authoring APIs. Runtime or host
   contracts shared with the API live below it in `pstdio-api-contracts`, not in
   API packages.

3. **Extension runtime**
   `pstdio-extensions` owns extension discovery, metadata normalization, bridge
   contracts, and package artifacts. It must not depend on `@pstdio/workbench`;
   workbench adapters for extension metadata belong in `@pstdio/workbench`.

4. **API host**
   `pstdio-api-runtime-host` and `pstdio-api` own runtime execution and HTTP/API
   orchestration. They consume contracts and extension runtime packages, but they
   do not import public SDK authoring-only types.

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
   and must not own router wiring, React Query fetching policy, dashboard
   project/repo concepts, or host persistence policy.

6. **Workbench**
   `@pstdio/workbench` owns workbench core contracts, layout, renderers, storage
   integration, and adapters from extension metadata into workbench modules. It is
   published to npm as a self-contained bundle (its private workspace deps,
   `pstdio-extensions` and `pstdio-api-contracts`, are inlined at build time). Its
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
   package graph treat a change to one of them as an e2e change, so pull request CI
   runs the e2e jobs for it.

8. **Packaging glue**
   `pstdio` may include generated packaging glue for compiled runtime artifacts.
   The host embeds the default extension catalog as data. Extension source is fetched
   from each entry's pinned Git origin and is not embedded in the host binary.
   Cross-package relative imports are only allowed for the
   generated embed manifest allowlist enforced by the boundary checker.

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
