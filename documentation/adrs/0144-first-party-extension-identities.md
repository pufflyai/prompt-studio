# First-party extension identities

Proposed: 2026-11-12

Status: Accepted. Ticket: PS-1175.

## Context

Repeating the publisher in names such as `pstdio.pstdio-notes` makes commands, links and discovery harder to read. Renaming only manifests would detach installed sources from their data and derive different encrypted streams.

## Decision

Keep the existing `publisher.name` identity rule. First-party manifest names omit the repeated `pstdio-` prefix: artifacts, base-themes, cloud, home, notes, onboarding, performance, planner, reports, session-browser, skills, workspaces and dev. Source directory and immutable source-origin paths stay unchanged. Other valid names and publishers retain their identities.

The host owns one explicit historical mapping. It normalizes loaded source metadata before source selection and builds invocation aliases from loaded structured contributions. It retains historical qualified and unqualified CLI routes during deprecation. Notes declares concise create, rename and delete paths while retaining its existing local command IDs. Discovery and new output use canonical identities.

A transactional startup migration moves complete database owner coordinates before extension activation. It retains source and instance IDs, enabled states, operation bytes, revisions, receipts, resource numbers and content. Typed platform references decode at their boundaries; arbitrary extension content remains unchanged. Allocated files migrate through verified, resumable copies before activation or the next authorized workspace access. Conflicting histories or files retain both versions and stop activation for the affected rename.

Encrypted transport names and opaque persisted derivations continue to use historical owners for both upgraded and new projects. This is permanent decoding metadata for supported persisted data, independent of the invocation deprecation period. No manifest alias fields, alias database or per-project stream flag are introduced.

The host support ships first in the coordinated extension API 0.5.0 release. Renamed extension packages follow in a separate release-dependent PR with `engines.pstdio` requiring 0.5.0. Old published coordinates retain their release history; catalog installation resolves their canonical replacement without a registry redirect.

POSIX migrations flush the destination tree and parent directory entries before removing the historical source. Windows retains the verified original under `.extension-identity-original` inside the canonical allocation, using a same-volume rename and native journal semantics. The host excludes this evidence from artifact discovery and ordinary file operations; it does not claim a stronger hardware power-loss guarantee. Cleanup of retained Windows evidence is a separate explicit action.

## Consequences

Users gain shorter commands without a second data owner or stream. A conflict requires resolving the two existing histories before activation can resume. The host retains historical identity facts as long as it supports old stored data. Removing invocation aliases requires a later coordinated breaking release with named replacements.

See the [upgrade guide](../guides/extensions/0011-identity-upgrades.md) and [API versioning](../references/extensions/0014-api-versioning.md).
