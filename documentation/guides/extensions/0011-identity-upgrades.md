# First-party extension identity upgrades

On `main`, after 0.46.0, the coordinated extension API 0.4.0 release introduces shorter first-party owners such as `pstdio.notes`, `pstdio.planner` and `pstdio.reports`. The host must ship before separately released extensions adopt these names. See [ADR 0144](../../adrs/0144-first-party-extension-identities.md).

## Commands and refs

Use `pst pstdio.notes create`, `pst pstdio.notes rename` and `pst pstdio.notes delete`. Folder commands remain `pst pstdio.notes folders <verb>`. Existing deliberate shortcuts such as `pst tickets create` and `pst reports write` keep working.

Historical namespaces remain callable during deprecation, including `pst pstdio.pstdio-notes notes create`, `pst pstdio-notes notes create` and `pst pstdio.notes notes create`. Human invocations print their canonical replacement to stderr. JSON and NDJSON output retain their existing machine-readable format. Ambiguous short names fail explicitly.

New discovery, typed refs and command results use canonical owners. Registered historical command and contribution IDs resolve only while their canonical provider is enabled and accessible. Exact machine-token grants retain their operations, digest, expiry and revocation state. The upgrade does not enable extensions or issue new grants.

## Existing projects

Database startup moves the complete owner and its dependent state transactionally before extension activation. Source and instance IDs, settings, record/file IDs, content, pending edits, numbered resources, revisions and immutable history remain intact. Saved typed navigation and layout refs resolve to canonical contributions. Old recovery-point owners decode through the same mapping.

Allocated files move from roots such as `.pstdio/extension-storage/pstdio.pstdio-notes/` to `.pstdio/extension-storage/pstdio.notes/`. Every available registered writable local workspace participates. A workspace that returns later migrates before its first directed access. Existing generated file links use the authorized workspace path resolver to reach the migrated file.

Equal destination files can be reused. Different bytes or distinct owner histories cause an explicit conflict; both versions remain available. Inspect the diagnostic's owner and scope, reconcile the intended source externally, then reload or restart to retry. Do not delete a namespace merely to suppress its diagnostic. Interrupted copies retain their source until verification completes and can be retried.

On Windows, the host keeps the verified original as `.extension-identity-original` inside the canonical allocation. It is protected evidence and does not appear as another artifact tree. This uses native same-volume rename and journal semantics; automatic deletion is deferred to a separate explicit cleanup action. POSIX hosts flush destination directories before deleting the old tree.

Encrypted owner catalogs, records, text and logs continue using the same historical transport names, including on a fresh device. No second stream is created. Do not downgrade an upgraded project to an older host.

## Release servicing

Source folders such as `extensions/pstdio-notes` stay unchanged. Install names and public package names become `notes`, `planner` and the other canonical names. Historical catalog arguments resolve to the canonical entry. Published historical versions are immutable and remain pinned to their final historical release unless the registry supports a redirect. The packaged catalog supplies the replacement without depending on that redirect.

Invocation aliases can retire only in a later breaking API release. Historical storage and transport decoding remains for the lifetime of supported persisted data.

*Updated at: 2026-11-12*
