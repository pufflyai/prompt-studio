# Extension Rules

- Always use the public `@pstdio/sdk` APIs when working on extensions.
- Do not import from app internals, package internals, or `clients/*` from extension code.
- Do not duplicate SDK behavior inside an extension. If the SDK is missing a needed capability, add it to the SDK first.
- When installing first-party extensions managed in this repo, always use `PSTDIO_HOME="$HOME/.pstdio-dev" pst extensions add <source> --force`. Do not copy or sync extension installs by hand.

## SDK and Extension Changes

When a change requires both SDK updates and extension updates:

- Make and validate the SDK change first.
- Test the extension against the SDK change by linking the local SDK package, for example `bun link` from `packages/sdk`, then `bun link @pstdio/sdk` from the extension package.
- Open one PR for the SDK change first.
- After the new SDK package is available, update the extension dependency to point to that SDK version and open a separate extension PR.
- Do not combine SDK and extension release changes in one PR unless explicitly requested.

## Extension Translations

- Use `l10n("stable.key", "Default copy")` from `@pstdio/sdk/extensions` for user-facing contribution text.
- Ship non-source locale bundles with `translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) }`.
- Keep bundles as flat JSON objects of string values and run `bun run verify:translations` after adding or changing translation keys.
