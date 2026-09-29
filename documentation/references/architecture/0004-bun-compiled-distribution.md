# Compiled CLI distribution

The CLI is built from `packages/pstdio/src/index.ts` with Bun's standalone compiler. The same executable runs commands and the shared API/dashboard runtime. This page describes the implemented build.

## Runtime entry points

- `pst` discovers or starts the shared runtime and opens its dashboard in a browser.
- `pst serve` starts or promotes a persistent runtime. The internal foreground mode runs the server in the current process.
- API-backed commands use authenticated runtime discovery before making requests.
- `pst close` requests shutdown through the runtime's activity gate.

The descriptor under the active `PSTDIO_HOME` records the origin, instance identity, and authentication data. Starting a second database owner is not an alternative to attaching to a healthy runtime. See [runtime commands](../cli/0003-setup.md) and [desktop lifecycle](0006-desktop.md).

## Embedded assets

The checked-in [embed configuration](../../../scripts/embed.json) lists the dashboard build, database migrations, and vendored PGlite assets. The build generates `_embed-manifest.generated.ts` with file imports and compiles it into the executable. Runtime asset resolution must work outside the source checkout.

PGlite supplies the PostgreSQL database. This is not a SQLite build. Its WASM/data assets are vendored before compilation. Template content and extension skills belong to installed extensions; see [template ownership](../../requirements/platform/0004-templates-and-skills.md).

The shared server serves API endpoints under `/v1` and the dashboard from the same origin. Browser sessions and CLI bearer authentication remain enforced in packaged mode. Do not copy an example server that routes `/api` or bypasses runtime authentication.

## Build commands

```sh
bun run build
bun run --cwd scripts build:host
bun run --cwd scripts verify:packages
```

The host build writes `dist/pstdio`. The multi-target command is:

```sh
bun run --cwd scripts build:all
```

It writes binaries under `packages/pstdio/dist/platforms/<package>/bin/`. The [build scripts](../../../scripts/build/build-all.ts) and [target resolver](../../../scripts/build/build-targets.ts) own the exact build process.

## Targets and publication

The configured targets are macOS arm64/x64, Linux arm64/x64, and Windows arm64/x64. Windows binaries use `pstdio.exe`; the others use `pstdio`. The embed configuration is the authoritative target list.

The `pstdio` distribution wrapper selects a platform package. Platform packages and public packages follow the fixed release group. A wrapper install and a direct compiled executable have different bootstrap requirements; the compiled executable includes its Bun runtime. Desktop packages also bundle a sidecar and have their own signing, installer, and update checks.

See [cross-platform requirements](../../requirements/platform/0001-cross-platform-support.md), [desktop distribution](../../requirements/platform/0002-desktop-distribution.md), and [versioning](../../requirements/platform/0005-versioning-and-releases.md). Do not infer that a target passed native execution checks merely because cross-compilation produced its binary.

## Packaged verification

[Package verification](../../../scripts/verify/verify-packages.ts) checks configured artifacts and runs the compatible host binary. Packaged smoke tests exercise isolated startup, project setup, extension defaults, and the bundled extension toolchain. Extension installation/building uses the bundled Bun runtime with `BUN_BE_BUN=1`; a separate Bun from `PATH` must not hide a missing packaged dependency.

Use `bun run --cwd packages/e2e test:packaged` for compiled CLI coverage. After building a desktop package, use `bun run --cwd clients/desktop test:packaged`. Tests own temporary homes and process cleanup. Never point package validation at production state.

For user-visible changes, complete the [manual installed-product walkthrough](../../lessons-learned/0013-manually-check-installed-user-flows.md) as well. A source build does not prove the installed artifact has every required file or dependency.
