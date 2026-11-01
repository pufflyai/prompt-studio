# Extension Rules

- Always use the public `@pstdio/sdk` APIs when working on extensions.
- Do not import from app internals, package internals, or `clients/*` from extension code.
- Do not duplicate SDK behavior inside an extension. If the SDK is missing a needed capability, add it to the SDK first.
- Use `PSTDIO_HOME="$HOME/.pstdio-dev" pst extensions dev <source>` as the active first-party extension authoring loop. Use `pst extensions add <source> --force` for a production-like install smoke test. Do not copy or sync extension installs by hand.
- Do not pass `--skip-install`. Installed extensions must have package-local dependencies, not `node_modules` symlinks back into the repo checkout.
- Never commit generated files, such as build output or the Canvas preview catalog in `canvas/src/catalog/generated/`. Only the exceptions in [Generated files](../documentation/guidance/0007-contributing.md#2-generated-files) may be committed.

## SDK and Extension Changes

When a change requires both SDK updates and extension updates:

- Make and validate the SDK change first.
- Test the extension against the SDK change by linking the local SDK package, for example `bun link` from `packages/sdk`, then `bun link @pstdio/sdk` from the extension package.
- Open one PR for the SDK change first.
- Open the extension change as a separate PR. If the SDK change is not published yet, add the red `waiting-for-release` label and name the SDK PR in the description. Its `published_extensions` check fails until the release.
- After the new SDK package is published, update the extension dependency to that SDK version, wait for `published_extensions` to pass, and remove the label.
- Do not combine SDK and extension release changes in one PR unless explicitly requested.

## Core extension releases

Core extensions share the host version through the fixed group in `.changeset/config.json`. Add each new core extension to that group. Continue naming changed extensions in changesets. One `pstdio@<version>` tag supplies all core extension code; do not create extension tags or releases. Shared versions do not update published SDK or UI dependency ranges.

## Shared keyboard actions

- Give each action one default shortcut. Use shared Create keys for creation and Go keys for destination navigation; do not also add a direct alias for the same action.
- Put resource creation actions in the shared `create` layer. Derive the key from the first letter of the canonical resource-kind ID, for example `note.ref.id[0]!.toUpperCase()`.
- Bind the existing public creation command. Include bound parameters for variants such as an agent provider, and name the resource and variant clearly.
- Reuse the resource's existing UI flow. For renderer-owned creation, bind the same command as `createRow.command`; the host reuses that form, properties, attachments, and submission handler. For immediate creation with optional parameters, bind an empty parameter object rather than opening a generic form.
- Reuse an initial when resources collide. The host sorts the available actions and gives them numbered choices; do not invent an extension-name step or reserve another resource's letter.
- Keep each numbered chooser stable while it is open. Extensions declare actions; the host owns selection, availability, and placeholder-card numbers.
- Contribute navigation to the shared `go` layer using the same target as the navigation item. Keep one canonical shortcut for shared settings actions such as choosing a color theme; do not add a copy for each provider.
- Group new extension flows by their purpose: Create, Go, Current view, Settings, View, or Help. Destination navigation belongs in Go; direct Option+Shift chords are for panel and tab controls. Do not use the deprecated `extensions` layer or require an extension-name step.

## Extension Translations

- Use `l10n("stable.key", "Default copy")` from `@pstdio/sdk/extensions` for user-facing contribution text.
- Ship non-source locale bundles with `translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) }`.
- Keep bundles as flat JSON objects of string values and run `bun run verify:translations` after adding or changing translation keys.
