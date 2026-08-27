# ADR 0015: Template content belongs to extensions

## Status

Accepted.

## Context

Core owned template tables, REST endpoints, SDK and CLI clients, prompt resolution, and a dashboard editor. A template is extension content, not shared platform plumbing. Extension storage already provides collections and file attachments, and extension commands already provide a generic host boundary.

Core also gave a hardcoded set of first-party extensions precedence over user templates. That privilege was unavailable to third-party extensions and broke the mission rule that first-party extensions use the same public interfaces as every other extension.

## Decision

The extension that declares a template type owns its shipped template assets and project overrides. It stores override metadata in an extension collection named `templates` and stores content as an attachment to that item. A user override wins over the shipped package asset in the owning extension.

Template types expose generic list, read, save, and delete command references. Workbench metadata carries those references, labels, and ordering to the dashboard. Core renders the editor by invoking those commands. Core does not resolve or store template content.

The core template tables, service, routes, contracts, SDK client, CLI namespace, command parameter type, and session template resolver are removed.

## Migration workaround

Ideally, the owning extension would migrate its old rows after the extension runtime loads. Database migrations run before that runtime exists, while the old tables must still exist. A clean runtime-owned migration is therefore impossible in the current startup order.

As a temporary, isolated workaround, the database startup migration maps the existing built-in template types to their current owners: `prompt`, `ticket`, and `document` to planner, and `report` to reports. It moves each live row into that extension instance's `templates` collection without copying the underlying file. The migration stops with a clear error if any live row has no owner, so content is never dropped silently. It is idempotent and runs immediately before the generated schema migration drops the old tables.

This workaround lives only in the legacy template migration module. Remove it after every supported database version has passed the schema migration that drops the old tables. A future migration system should allow extensions to run owned data migrations before core schema removal.

## Consequences

- Every extension gets the same template storage and dashboard behavior.
- User changes consistently override shipped assets.
- Reading another extension's template requires invoking that extension's declared command.
- Existing supported template rows retain their file content and become editable extension data.
- Unknown or unowned legacy types block the upgrade instead of losing content.
- Skills remain a separate core subsystem and are not changed by this decision.
