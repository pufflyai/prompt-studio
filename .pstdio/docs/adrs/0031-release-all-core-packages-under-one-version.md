# ADR 0031: Release all core packages under one version

Status: accepted for PS-410.

## Context

Each Prompt Studio package used to have its own version, tag and GitHub release. One release run created up to 15 releases, and the versions drifted apart. At the time of writing they range from 0.2.0 to 2.0.2.

The host already treats core extensions as part of its own release. The catalog's `{hostRelease}` ref makes a host at version X install every core extension from the `pstdio@X` tag (ADR 0014, PS-277, PS-284). So an extension's own version and tag never decided what users received. The version was only displayed, and it could disagree with the installed code.

## Decision

pstdio, @pstdio/sdk, @pstdio/ui, @pstdio/workbench, @pstdio/desktop and every core extension in `extensions/` share one version.

- One Changesets fixed group holds them. `validate:changesets` requires every released workspace package to be in that group.
- Each release creates one tag, `pstdio@X.Y.Z`, and one GitHub release titled `vX.Y.Z`. Its notes are grouped by package.
- The `pstdio@` tag prefix stays, because the desktop updater, extension installs and `install.sh` depend on it.
- Extensions keep their own `@pstdio/sdk` and `@pstdio/ui` dependency ranges (ADR 0030). The shared version changes the version number, never those ranges.
- Third-party extensions are outside this decision. They release from their own repositories, and their catalog entries name their own refs.

## Consequences

- A single version identifies an entire installation. A core extension's displayed version equals the host release it came from.
- Every release republishes all npm packages, including unchanged ones.
- Adding a core extension requires adding it to the fixed group. CI enforces this.
- After merge and approval of the deletion list, the old per-extension tags and releases are deleted, and their names can never be reused because immutable releases are turned on.

## Alternatives

- **Independent versions, one combined release page.** This keeps drifting numbers that don't match what the host installs. It also needs a table to map versions onto a release.
- **Lexical's `vX.Y.Z` tag.** Desktop apps at 0.34.0 and older look only for `pstdio@` tags and would stop auto-updating. Supporting both would need two releases per version.
- **Core extensions on their own tags.** This needs a stable extension API with compatible version ranges. Today a manifest must match the alpha API version exactly. The bundled catalog also changes only when the host ships, so separate tags would add bookkeeping without enabling separate releases.

## Revisit when

The extension API supports compatible version ranges, and core extensions need to ship between host releases.
