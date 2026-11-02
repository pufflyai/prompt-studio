# Template content belongs to extensions — Temporary legacy migration

Proposed: 2026-08-28

Status: Accepted for template ownership. [ADR 0077](0077-extension-owned-data-migrations.md) replaced the temporary core migration; [ADR 0103](0103-database-baseline-replaces-in-place-upgrades.md) later retired in-place upgrades.

## Context

Templates are extension content. Core template storage and privileged first-party precedence duplicated public extension capabilities and violated equal treatment of external extensions.

## Decision

1. The extension declaring a template type owns its shipped assets and project overrides. Store override metadata in its `templates` collection and content as an attachment. User overrides win over shipped assets.
2. Expose list, read, save, and delete commands through generic workbench metadata. Core renders the editor through those commands; it neither stores nor resolves template content.
3. Reading another extension's template requires its declared command. First-party and external extensions use the same contract.
4. Core template tables, endpoints, clients, and session resolution are removed. Skills are a separate subsystem.

## External limitation

Historically, schema migrations ran before extension code could load. Core temporarily mapped legacy template types to owners and repaired missing installations so content could survive table removal. That startup ordering prevented an extension-owned conversion at the required boundary.

## Removal

The domain-specific migration and installation repair were removed in favor of extension-owned migrations. Release 0.46 subsequently replaced retained table archives with baseline exports. Keep the template ownership decision; do not restore the retired core mapping or installation repair.
