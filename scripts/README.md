# scripts/

Build and verification scripts for the `pstdio` CLI binary.

## `embed.json`

Allowlist of files baked into the compiled `pstdio` binary by Bun (`--compile`).
This file is the source of truth — the build scripts read it, fail loudly when
anything is missing, and refuse to ship a stray file under the curated roots.

```jsonc
{
  // Generated trees included via directory globs.
  // Pattern must end with `/**` (only suffix glob is supported).
  "globs": [
    "packages/pstdio-dashboard/dist/**",
    "packages/pstdio-db/drizzle/**"
  ],

  // Curated content (skills, plugins, templates) listed explicitly.
  // Every path must exist; the build fails otherwise.
  "files": [
    "packages/pstdio/files/plugins/.../foo.ts.txt",
    "packages/pstdio-agents/files/skills/.../SKILL.md"
  ],

  // Roots scanned for "stray" files: any file under one of these roots that
  // is not in `files` causes the build to fail. This catches accidental
  // commits to e.g. CLI_FILES/plugins/ that would otherwise ship silently.
  "noStraysIn": [
    "packages/pstdio/files",
    "packages/pstdio-agents/files"
  ],

  // Per-platform binaries that `verify-packages.ts` expects to find.
  "platformBinaries": [{ "pkg": "cli-darwin-arm64", "bin": "pstdio" }, ...],

  // Build targets used by `build-all.ts` to cross-compile.
  "buildTargets": [{ "target": "bun-darwin-arm64", "pkg": "cli-darwin-arm64", "bin": "pstdio" }, ...]
}
```

## Adding a new bundled file

1. Add the path to `files` in `embed.json`.
2. Run `bun run scripts/build-compile.ts` and verify the manifest contains it.

## Adding a new build target

1. Add the entry under `buildTargets` (used by `build-all.ts`) and
   `platformBinaries` (used by `verify-packages.ts`).
