# Package Boundaries

Prompt Studio keeps package ownership explicit so shared packages do not absorb
app, runtime, or packaging concerns. The source of truth for mechanical rules is
`scripts/verify/verify-boundaries.ts`; update this document with any intentional
layer-map change.

## Layers

The boundary verifier encodes these layers as numeric package indexes. A
workspace package may declare a dependency only on a package with a strictly
lower index. The indexes are sometimes more granular than the headings below
when packages in the same conceptual layer have a real dependency order, such
as logging depending on paths or the API depending on the API runtime host.

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
   contracts, and package artifacts. It must not depend on `pstdio-workbench`;
   workbench adapters for extension metadata belong in `pstdio-workbench`.

4. **API host**
   `pstdio-api-runtime-host` and `pstdio-api` own runtime execution and HTTP/API
   orchestration. They consume contracts and extension runtime packages, but they
   do not import public SDK authoring-only types.

5. **Primitive UI**
   `@pstdio/ui` owns reusable React primitives, visual components, theme tokens,
   and editor widgets. It must not own router wiring, React Query fetching
   policy, dashboard project/repo concepts, or host persistence policy.

6. **Workbench**
   `pstdio-workbench` owns workbench core contracts, layout, renderers, storage
   integration, and adapters from extension metadata into workbench modules. Its
   core API must not import `@pstdio/ui`, including type-only imports.

7. **Product apps and tests**
   `pstdio-dashboard`, `pstdio-extension-testbench`, extensions, clients, and
   `e2e` compose lower layers into product workflows. They must import workspace
   packages through declared package dependencies and package exports.

8. **Packaging glue**
   `pstdio` may include generated packaging glue for compiled artifacts and
   embedded defaults. Cross-package relative imports are only allowed for the
   generated embed manifest allowlist enforced by the boundary checker.

## Rules

- No workspace package cycles.
- Every declared workspace dependency must point to a strictly lower package
  layer index, even when the dependency appears in the explicit allowlist.
- No cross-package relative imports except explicit generated packaging
  allowlists.
- No imports from `clients/*`.
- Every workspace package import must be declared in the importer's
  `package.json`.
- Extensions may only depend on `@pstdio/sdk` and `@pstdio/ui`.
- `@pstdio/ui` may not import or declare router or React Query dependencies.
- `@pstdio/ui` may not use `node:*` imports in UI source. Current legacy type
  shims are allowlisted in the verifier until they are removed.
- Framework packages have content denylists for product-domain vocabulary such
  as ticket, tag, status, and template. Existing legacy files are listed in the
  verifier allowlist so current validation stays green while new leaks fail.
- Workbench core import restrictions are enforced by the central verifier using
  parsed TypeScript specifiers. Core may not import `@pstdio/ui`, including
  type-only imports, and runtime React/Chakra/dashboard imports remain blocked.
- E2E tests use package exports and declare every workspace dependency they
  import.
