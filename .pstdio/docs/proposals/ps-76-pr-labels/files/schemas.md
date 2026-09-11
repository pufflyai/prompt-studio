# Label catalog and configuration

These are proposed GitHub labels. Automatic labels mean "this PR touches a sensitive area." They do not express severity. Multiple labels can apply. Use amber for automatic labels and red for manual consequence labels; text carries the meaning without color.

## Initial automatic labels

| Label | Changed-path patterns | Description and review focus |
| --- | --- | --- |
| `extensions` | `extensions/**` | Extension implementations: review tool behavior and use of public SDK contracts. Must not be combined with `sdk` in one PR. |
| `sdk` | `packages/sdk/**`, `packages/pstdio-api-contracts/**` | Public contracts: review extension compatibility, types, and API behavior. |
| `database` | `packages/pstdio-db/**`, `packages/pstdio-storage/**` | Persistent data: review schema, migrations, data integrity, and file storage. |
| `extension-runtime` | `packages/pstdio-extensions/**`, `packages/pstdio-api-runtime-host/**`, `packages/pstdio-api/src/features/extensions/**` | Extension execution: review installation, lifecycle, bridges, and process handling. |
| `security` | `packages/pstdio-api/src/features/runtime/runtime-auth.ts`, `packages/pstdio-api/src/features/extensions/connection-secret-store.ts`, `packages/pstdio-api/src/features/extensions/extension-webview-access.ts`, `packages/pstdio-api/src/app-routing.ts` | Trust boundaries: review authentication, secret handling, and webview access. |
| `sync` | `packages/pstdio-api/src/features/sync/**`, `packages/pstdio-api/src/services/sync-service.ts`, `packages/sdk/src/client/sync.ts` | Shared state: review event delivery, ordering, reconnects, and consistency. |
| `release` | `.github/workflows/**`, `.github/labeler.yml`, `scripts/build/**`, `scripts/release/**`, `scripts/embed.json`, `.changeset/config.json` | Delivery controls: review CI permissions, packaging, publishing, and risk classification. |

The security list is an initial set of concrete locations, not an exhaustive security detector. Review adjacent authentication and desktop isolation code during implementation and add precise paths where needed. Do not label every API file as security-sensitive.

## Manual labels

| Label | Meaning |
| --- | --- |
| `breaking-change` | A reviewer identifies an incompatible contract or behavior change. Record the affected consumers in the PR description. |
| `needs-migration` | A reviewer identifies a required persisted-data transition. Explain the migration and recovery approach in the PR description. |

These labels must not appear in the automatic mapping file. A changed migration file can be detected by path, but whether a migration is needed requires judgment.

## Optional later labels

- `workbench`: `packages/pstdio-workbench/**` and `packages/ui/**`; shared rendering and UI contracts.
- `workspaces`: `packages/pstdio-wt/**`, `extensions/remote-workspaces/**`, and the workspace feature in the API; filesystem and remote execution changes.
- `dependencies`: `bun.lock` and package manifests; dependency updates with broad effects. Expect significant overlap and noise.
- `change:migration`: `packages/pstdio-db/drizzle/**`; an objective signal that generated migration files changed, distinct from `needs-migration`.

Start with the seven automatic labels. Add optional labels only when reviewers find a concrete use for them.

## Mapping shape

Use the maintained action's changed-file matcher. For example, the `sdk` key contains a `changed-files` rule whose `any-glob-to-any-file` list contains `packages/sdk/**` and `packages/pstdio-api-contracts/**`. Repeat that shape for the other rows.

Only automatic labels belong in this mapping. Label names must exactly match the repository labels. Do not add file-count or label-count limits that silently skip broad changes. No application database or API schema changes are required.

## Required label policy

After successful synchronization, fail `sdk-extension-separation` exactly when both `sdk` and `extensions` are present. Either label alone, neither label, and unrelated labels pass. `extensions` covers repository extension implementations; `extension-runtime` covers the platform that runs them. Keep those meanings distinct. The existing `sdk` mapping also includes `packages/pstdio-api-contracts/**`, so combining those contract changes with extension changes is blocked too.
