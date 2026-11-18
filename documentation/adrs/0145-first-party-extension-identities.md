# First-party extension identities

Proposed: 2026-11-12

Status: Accepted. Ticket: PS-1175.

## Context

Repeating the publisher in names such as `pstdio.pstdio-notes` makes commands, links and discovery harder to read. Renaming only manifests would detach installed sources from their data and derive different encrypted streams.

## Decision

Keep the existing `publisher.name` identity rule. First-party manifest names omit the repeated `pstdio-` prefix: artifacts, base-themes, cloud, home, notes, onboarding, performance, planner, reports, session-browser, skills, workspaces and dev. Source directory and immutable source-origin paths stay unchanged. Other valid names and publishers retain their identities.

The host owns one explicit historical mapping. It normalizes loaded source metadata before source selection and builds invocation aliases from loaded structured contributions. It retains historical qualified and unqualified CLI routes during deprecation. Notes declares concise create, rename and delete paths while retaining its existing local command IDs. The same API 0.5.0 release removes extension-defined global shortcuts; CLI commands remain owned by their publisher-qualified namespace. Historical namespace aliases are separate from removed root shortcuts. Discovery and new output use canonical identities.

A transactional startup migration moves complete database owner coordinates before extension activation. It retains source and instance IDs, enabled states, operation bytes, revisions, receipts, resource numbers and content. Typed platform references decode at their boundaries; arbitrary extension content remains unchanged. Allocated files migrate through verified, resumable copies before activation or the next authorized workspace access. Conflicting histories or files retain both versions and stop activation for the affected rename.

Encrypted transport names and opaque persisted derivations continue to use historical owners for both upgraded and new projects. This is permanent decoding metadata for supported persisted data, independent of the invocation deprecation period. No manifest alias fields, alias database or per-project stream flag are introduced.

The host support ships first in the coordinated extension API 0.5.0 release. Renamed extension packages follow in a separate release-dependent PR with `engines.pstdio` requiring 0.5.0. Old published coordinates retain their release history; catalog installation resolves their canonical replacement without a registry redirect.

POSIX migrations flush the verified destination and its parent directories before retiring the historical source with a same-volume rename. The host tries to remove the retired tree after flushing the rename. Any remainder stays under `.extension-identity-original` inside the canonical allocation. Windows retains the verified original at the same location using native journal semantics. The host excludes retained files from artifact discovery and ordinary file operations.

Asset bytes remain readable at their historical owner paths. The host checks the canonical path first and uses the historical path for missing versions or in-progress uploads. New transfers and newly published versions use canonical paths.

## Consequences

Users gain shorter commands without a second data owner or stream. A conflict requires resolving the two existing histories before activation can resume. The host retains historical identity facts as long as it supports old stored data. Removing the retained namespace migration aliases requires a later coordinated breaking release with named replacements. Root shortcuts such as `pst tickets write` are removed in the current API 0.5.0 release, using `pst pstdio.planner write-ticket` as the replacement.

See the [upgrade guide](../guides/extensions/0011-identity-upgrades.md) and [API versioning](../references/extensions/0014-api-versioning.md).
