# Package Boundaries

Prompt Studio keeps package ownership explicit so shared packages do not absorb
app, runtime, or packaging concerns. The source of truth for mechanical rules is
`scripts/verify/verify-boundaries.ts`; update this document with any intentional
layer-map change.

## Layers

1. **Contracts and utilities**
   `pstdio-api-contracts`, `pstdio-file-types`, `pstdio-paths`,
   `pstdio-logging`, `pstdio-scheduler`, `pstdio-wt`, and `pstdio-db` define
   stable contracts, file-type metadata, paths, logging, scheduling, git, and
   persistence primitives. They do not
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
   subpath from `pstdio`, path/logging utilities, and `@pstdio/ui`. It must not
   import API domain services, database packages, or another client.

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
- No imports from `clients/*`.
- Every workspace package import must be declared in the importer's
  `package.json`.
- Extensions may only depend on `@pstdio/sdk` and `@pstdio/ui`.
- `@pstdio/ui` may not import or declare router or React Query dependencies.
- E2E tests use package exports and declare every workspace dependency they
  import.
