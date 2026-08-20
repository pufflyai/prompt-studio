# Spec: Compiled Binary Distribution for pstdio

## 1) Goal

Produce standalone pstdio CLI executables for each supported platform using `bun build --compile`. Distribute through two channels:

- `curl -fsSL https://pstdio.dev/install.sh | sh` — direct binary download
- `npm i -g pstdio` — npm global install + platform packages

End users MUST NOT need Bun or Node.js installed.

---

## 2) What changes from today

| Aspect       | Today                                         | After                                           |
| ------------ | --------------------------------------------- | ----------------------------------------------- |
| Runtime      | Node.js (built with `--target node`)          | None (standalone binary)                        |
| Externals    | `ink`, `react`, `ink-text-input` externalized | Everything bundled into binary                  |
| API server   | Separate `server.js` spawned via `node`       | Embedded in same binary, started via subcommand |
| Distribution | Single npm package `pstdio`                   | Two channels: `curl \| sh` + npm wrapper        |
| Install size | ~4MB JS + node_modules                        | ~60-90MB single binary                          |

---

## 3) Architecture: single binary, two modes

The compiled binary handles both CLI and API server via a subcommand:

```
pst                 # launches or focuses the separately installed desktop
pst --help          # normal CLI help
pst serve           # starts or promotes the shared persistent runtime
```

### Why single binary

- API-backed CLI subcommands start the runtime automatically through `ensureApi`. In a compiled binary, that startup path self-spawns the same binary in foreground serve mode. Bare `pst` is excluded: it delegates launch/focus to the installed desktop, which owns discovery and startup.
- No need to distribute two binaries.
- `Bun.serve()` works in compiled binaries.

### Key constraint: no sidecar files

A compiled single binary MUST NOT depend on sibling files on disk. Hono's `serveStatic` resolves files relative to the process's current working directory, which breaks when the binary runs from an arbitrary location. All assets the binary needs must be embedded inside it.

This applies to project seeding inputs too. Default templates and default skills must be resolved from embedded assets in compiled mode (with filesystem fallback only for workspace/dev execution), otherwise `POST /v1/projects` can fail with 500 in published binaries.

### Entry point change

`src/cli.ts` becomes the single entry point for compilation. It imports from both the current CLI code and the API server code:

```ts
// src/cli.ts — compiled entry point
import { createApp } from "pstdio-api/app"; // Hono app (API routes only)
import { cli } from "./cli-setup"; // current yargs setup

// "serve" subcommand starts Bun.serve() with:
//   - embedded dashboard assets served by Bun directly
//   - /api/* routed to the Hono app
// all other subcommands work as today
```

The API's `createApp()` is imported directly — no subprocess needed when running in-process. The `ensureApi` flow changes to:

1. Check if API is already running (health check)
2. If not, spawn `pst serve` as a detached background process (the binary spawns itself via `process.execPath`)

---

## 4) Bun APIs used in compiled binary

All of these work in `bun build --compile`:

| API                        | Where                                           | Status                                         |
| -------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| `Bun.serve()`              | HTTP server (dashboard + API)                   | Works in compiled binaries                     |
| `Bun.embeddedFiles()`      | Serving dashboard assets from inside the binary | Available since Bun v1.2.17                    |
| `Bun.file()`               | Reading embedded files at runtime               | Works with embedded files                      |
| `Bun.spawn()`              | `pstdio-wt` git operations                      | Works in compiled binaries                     |
| `Bun.write()`              | File operations in tests                        | Test-only, not in binary                       |
| `process.execPath`         | Self-spawning for `ensureApi`                   | Points to the compiled binary itself           |
| Drizzle ORM + `bun:sqlite` | `pstdio-db`                                     | Works — Bun embeds SQLite in compiled binaries |

### Not used

- `Bun.sql` / `import { SQL } from "bun"` — not applicable, we use Drizzle with SQLite
- Hono `serveStatic` — not used in compiled builds (dashboard served via embedded files)
- No native addons or FFI

---

## 5) Build targets

### Minimum (ship first)

| Target             | Package name               | Binary       |
| ------------------ | -------------------------- | ------------ |
| `bun-darwin-arm64` | `@pstdio/cli-darwin-arm64` | `pst`        |
| `bun-darwin-x64`   | `@pstdio/cli-darwin-x64`   | `pst`        |
| `bun-linux-x64`    | `@pstdio/cli-linux-x64`    | `pst`        |
| `bun-linux-arm64`  | `@pstdio/cli-linux-arm64`  | `pst`        |
| `bun-windows-x64`  | `@pstdio/cli-win-x64`      | `pstdio.exe` |

### Later

- `bun-linux-x64-musl` / `bun-linux-arm64-musl` for Alpine/Docker
- `bun-windows-arm64`

---

## 6) Distribution channel 1: `curl | sh`

### Install script

Hosted at `https://pstdio.dev/install.sh` (or GitHub raw URL). The script:

1. Detects `uname -s` (OS) and `uname -m` (arch)
2. Maps to the correct binary name
3. Downloads from GitHub Releases: `https://github.com/<org>/prompt-studio/releases/latest/download/pstdio-<os>-<arch>`
4. Places binary in `/usr/local/bin/pstdio` (or `~/.local/bin/pstdio` without sudo)
5. Sets executable bit
6. Verifies with `pst --version`

```bash
curl -fsSL https://pstdio.dev/install.sh | sh
```

### GitHub Release assets

Each release tag uploads:

```
pstdio-darwin-arm64
pstdio-darwin-x64
pstdio-linux-x64
pstdio-linux-arm64
pstdio-win-x64.exe
install.sh
```

---

## 7) Distribution channel 2: `npm i -g pstdio`

Uses the wrapper + platform packages model.

### Wrapper package: `pstdio`

Same npm package name as today. The `package.json` changes:

```json
{
  "name": "pstdio",
  "version": "0.1.0",
  "bin": {
    "pstdio": "./bin/pstdio.js"
  },
  "files": ["bin"],
  "optionalDependencies": {
    "@pstdio/cli-darwin-arm64": "0.1.0",
    "@pstdio/cli-darwin-x64": "0.1.0",
    "@pstdio/cli-linux-x64": "0.1.0",
    "@pstdio/cli-linux-arm64": "0.1.0",
    "@pstdio/cli-win-x64": "0.1.0"
  }
}
```

### Wrapper launcher: `bin/pstdio.js`

```js
#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

function getPackageName() {
  const p = process.platform;
  const a = process.arch;

  if (p === "darwin" && a === "arm64") return "@pstdio/cli-darwin-arm64";
  if (p === "darwin" && a === "x64") return "@pstdio/cli-darwin-x64";
  if (p === "linux" && a === "x64") return "@pstdio/cli-linux-x64";
  if (p === "linux" && a === "arm64") return "@pstdio/cli-linux-arm64";
  if (p === "win32" && a === "x64") return "@pstdio/cli-win-x64";

  throw new Error(
    `pst does not support ${p} ${a}. ` +
      `Supported: darwin-arm64, darwin-x64, linux-x64, linux-arm64, win-x64`,
  );
}

const binPath = require(getPackageName());
const result = spawnSync(binPath, process.argv.slice(2), { stdio: "inherit" });
process.exit(result.status ?? 1);
```

### Platform packages: `@pstdio/cli-<platform>`

Each contains:

```
@pstdio/cli-linux-x64/
├─ package.json
├─ index.cjs
└─ bin/
   └─ pstdio
```

`index.cjs`:

```js
const path = require("node:path");
module.exports = path.join(__dirname, "bin", "pstdio");
```

`package.json`:

```json
{
  "name": "@pstdio/cli-linux-x64",
  "version": "0.1.0",
  "os": ["linux"],
  "cpu": ["x64"],
  "files": ["bin", "index.cjs"],
  "main": "./index.cjs"
}
```

---

## 8) Build script

`scripts/build-all.ts` first builds the dashboard, then compiles the single entry point for each target with dashboard assets embedded:

```ts
import { $ } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

// 1. Build the dashboard
await $`bun run --filter pstdio-dashboard build`;

// 2. Collect dashboard dist files for embedding
const dashboardDist = "./packages/pstdio-dashboard/dist";
const distFiles = await readdir(dashboardDist, { recursive: true });
const embedArgs = distFiles
  .filter((f) => !f.startsWith("."))
  .flatMap((f) => ["--embed", join(dashboardDist, f)]);

// 3. Compile for each target with embedded assets
const TARGETS = [
  { target: "bun-darwin-arm64", pkg: "cli-darwin-arm64", bin: "pstdio" },
  { target: "bun-darwin-x64", pkg: "cli-darwin-x64", bin: "pstdio" },
  { target: "bun-linux-x64", pkg: "cli-linux-x64", bin: "pstdio" },
  { target: "bun-linux-arm64", pkg: "cli-linux-arm64", bin: "pstdio" },
  { target: "bun-windows-x64", pkg: "cli-win-x64", bin: "pstdio.exe" },
];

for (const { target, pkg, bin } of TARGETS) {
  const outfile = `./packages/${pkg}/bin/${bin}`;
  await $`bun build ./src/cli.ts --compile --target=${target} ${embedArgs} --outfile ${outfile}`;
}
```

---

## 9) Serving architecture: Bun owns assets, Hono owns API

The `serve` subcommand starts a single `Bun.serve()` instance that handles both dashboard and API traffic.

### Dashboard assets: embedded in the binary

The dashboard build output is embedded into the compiled binary using Bun's file embedding. At runtime, `Bun.embeddedFiles()` enumerates them and `Bun.file()` reads them. Hono's filesystem-based `serveStatic` is **not used** for the dashboard in compiled builds.

```ts
// serve subcommand — simplified
import { createApp } from "pstdio-api/app";

const app = createApp(); // Hono app with /api/* routes

// Embed dashboard assets at compile time
const embeddedAssets = new Map<string, Blob>();
for (const file of Bun.embeddedFiles()) {
  // file.name is the relative path from the embed root
  embeddedAssets.set(file.name, file);
}

Bun.serve({
  port: apiPort,
  fetch(req) {
    const url = new URL(req.url);

    // API routes → Hono
    if (url.pathname.startsWith("/api")) {
      return app.fetch(req);
    }

    // Dashboard assets → embedded files
    const assetPath =
      url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const asset = embeddedAssets.get(assetPath);
    if (asset) {
      return new Response(asset, {
        headers: { "Content-Type": asset.type },
      });
    }

    // SPA fallback → serve index.html for client-side routing
    const index = embeddedAssets.get("index.html");
    if (index)
      return new Response(index, { headers: { "Content-Type": "text/html" } });

    return new Response("Not Found", { status: 404 });
  },
});
```

### API server self-spawn via `ensureApi`

The `ensureApi` logic changes to spawn the same binary:

```ts
// today: spawns `node api/server.js` or `bun run start`
// after: spawns the same binary with `serve` subcommand

export const runApi = (options) => {
  const binary = process.execPath; // points to the compiled pstdio binary itself
  const child = spawn(binary, ["serve"], {
    stdio: "ignore",
    detached: true,
    env: { ...process.env, PORT: apiPort },
  });
  child.unref();
};
```

`process.execPath` in a Bun-compiled binary points to the binary itself. This is the documented way to self-spawn a Bun compiled executable.

---

## 10) Repository layout changes

```
prompt-studio/
├─ src/
│  └─ cli.ts                          # compiled entry point (new)
├─ scripts/
│  ├─ build-all.ts                     # cross-platform compile
│  ├─ verify-packages.ts               # validate binaries + packaged runtime smoke
│  └─ install.sh                       # curl install script
├─ packages/
│  ├─ pstdio/                          # wrapper package (npm)
│  │  ├─ package.json                  # optionalDependencies on platform pkgs
│  │  └─ bin/
│  │     └─ pstdio.js                  # Node launcher
│  ├─ cli-darwin-arm64/                # platform packages
│  │  ├─ package.json
│  │  ├─ index.cjs
│  │  └─ bin/
│  │     └─ pstdio                     # compiled binary (gitignored)
│  ├─ cli-darwin-x64/
│  ├─ cli-linux-x64/
│  ├─ cli-linux-arm64/
│  └─ cli-win-x64/
├─ ...existing packages (pstdio-api, pstdio-db, etc.)
```

Platform `bin/` directories are gitignored. Binaries are built in CI only.

---

## 11) CI release workflow

```yaml
# .github/workflows/release.yml
steps:
  - checkout
  - setup bun
  - bun install
  - bun run test
  - bun run scripts/build-all.ts
  - bun run scripts/verify-packages.ts

  # GitHub Release (curl channel)
  - upload pstdio-darwin-arm64 to release
  - upload pstdio-darwin-x64 to release
  - upload pstdio-linux-x64 to release
  - upload pstdio-linux-arm64 to release
  - upload pstdio-win-x64.exe to release
  - upload install.sh to release

  # npm (npx channel)
  - npm publish @pstdio/cli-darwin-arm64
  - npm publish @pstdio/cli-darwin-x64
  - npm publish @pstdio/cli-linux-x64
  - npm publish @pstdio/cli-linux-arm64
  - npm publish @pstdio/cli-win-x64
  - npm publish pstdio # wrapper last
```

All packages share the same version. Platform packages publish before the wrapper.

`scripts/verify-packages.ts` now includes a required runtime smoke check on the host-platform compiled binary:

1. start `<platform-binary> serve` with isolated `PSTDIO_HOME`
2. call `POST /v1/projects`
3. assert default templates and default skills were seeded via API

This closes the gap where binary presence was verified but core packaged behavior was not.

It also validates the packaged extension toolchain path. After all configured platform package binaries are checked for presence, the verifier runs the current host's compiled pstdio binary with `BUN_BE_BUN=1` and an isolated `BUN_INSTALL_CACHE_DIR` against a temporary extension fixture. The smoke runs both `install --ignore-scripts` and `build <entry> --target=browser --format=esm --outfile <file>` through the compiled binary itself, not through `bun` from `PATH` or a separate Bun sidecar.

Packaged extension install/build/watch can use `process.execPath` with `BUN_BE_BUN=1` and a Prompt Studio controlled cache directory. The verifier executes the host-compatible compiled binary by default, or the package named by `PSTDIO_VERIFY_PLATFORM_PKG` for musl or other explicit target jobs. Release CI must run this script in the platform matrix for each supported target that needs runtime coverage; cross-compiled binaries for other OS/arch targets are presence-checked but not executed on incompatible hosts.

Current release CI runs runtime `BUN_BE_BUN` smoke coverage for `cli-linux-x64`, `cli-linux-x64-musl`, `cli-darwin-x64`, and `cli-win-x64`. Arm64 Linux, Darwin, and Windows package binaries are built and presence-checked in the verifier; they need dedicated hosted runners before they can receive the same runtime smoke coverage in CI.

---

## 12) Migration path

### Phase 1: compiled entry point with embedded dashboard

- Create `src/cli.ts` that imports both CLI and API code
- Add `pst serve` subcommand using `Bun.serve()` as the outer HTTP server
- Embed dashboard dist into the binary via `bun build --compile --embed`
- Serve dashboard assets from `Bun.embeddedFiles()`, route `/api/*` to Hono
- Remove Hono `serveStatic` usage for dashboard in compiled builds
- Update `ensureApi` to self-spawn via `process.execPath` with `serve`
- Verify `bun build --compile` works for darwin-arm64 (local machine)

For manual local smoke testing, point `pst` at the compiled binary after building:

```bash
alias pstdio="$PWD/dist/pstdio"
```

Run that from the repo root. It lets contributors run normal commands such as `pst --help` or `pst serve` against the compiled executable without changing their global install.

### Phase 2: platform packages

- Create platform package scaffolding (package.json, index.cjs)
- Create wrapper launcher (`bin/pstdio.js`)
- Create `scripts/build-all.ts`
- Test `pst` locally after global install

### Phase 3: curl install

- Write `install.sh`
- Set up GitHub Release workflow
- Test on a clean machine without Bun/Node

### Phase 4: remaining platforms

- Add musl targets for Alpine/Docker
- Add Windows arm64
- Add checksum verification to install script

---

## 13) Design decision: Bun serves assets, Hono serves API

The compiled binary uses a clear separation:

- **Bun** owns all embedded dashboard assets. The build step embeds the dashboard dist into the binary via `bun build --compile --embed`. At runtime, `Bun.serve()` is the outer HTTP server. It serves dashboard assets from `Bun.embeddedFiles()` and delegates `/api/*` to Hono.
- **Hono** owns API routes only. It does not use `serveStatic` or reference the filesystem for dashboard files.
- **`ensureApi`** self-spawns the binary via `process.execPath` with the `serve` subcommand.

This avoids the main risk: a compiled single binary depending on sibling `dist/` folders or Hono's filesystem-based static serving. Since Bun v1.2.17, `bun build --compile` supports embedding arbitrary files and exposing them via `Bun.embeddedFiles()`, which is purpose-built for this use case.
