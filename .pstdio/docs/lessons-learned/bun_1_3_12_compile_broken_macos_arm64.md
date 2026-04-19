# Bun 1.3.12 `--compile` Produces Broken Binaries on macOS arm64

## Problem

`bun build --compile` on macOS arm64 with Bun **1.3.12** produces a Mach-O executable that is killed immediately on launch (`exit 137`, no stdout, no stderr).

The generated binary is malformed at the Mach-O layer, not merely unsigned:

- `codesign -dv <binary>` reports `code object is not signed at all`.
- `codesign --force --sign - <binary>` fails with `invalid or unsupported format for signature`.

Reproduces with a minimal program (not specific to this repo):

```bash
echo 'console.log("hello")' > hello.ts
bun build ./hello.ts --compile --outfile ./hello
./hello   # exit 137, silent
```

Swapping the Bun CLI to **1.3.11** (same machine, same source) produces a working binary that runs and signs cleanly. `bun run reset` does not help — it is purely a Bun-version issue.

## Impact

`scripts/build-compile.ts` and `scripts/build-all.ts` both invoke `bun build --compile`, so `bun run build` / `bun run reset` / `bun run validate` all fail on macOS arm64 under Bun 1.3.12. The CI release workflow would ship broken darwin-arm64 binaries if the pinned Bun version is bumped to 1.3.12.

## Workaround

Stay on Bun **1.3.11** for now. This is the highest tested version where `--compile` produces valid darwin-arm64 binaries. All version pins (`package.json` engines + `packageManager`, `@types/bun`, Dockerfiles, `oven-sh/setup-bun` workflows) are held at 1.3.11.

## When Bun fixes this

Re-run the minimal reproduction above with the new Bun version. If `./hello` runs and `codesign -dv` reports a valid signature, bump every `1.3.11` pin listed above together, re-run `bun run reset`, and verify `./dist/pstdio --version` prints.
