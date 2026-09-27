# Temporary native build tool selection

Proposed: 2026-09-13

## Status

Accepted as a temporary workaround.

## Intended design

Native dependency installation should use the workspace's locked `node-gyp` version.

## External limitation

Bun 1.4.2's isolated dependency layout does not expose the root build tool to every dependency script. Bun falls back to `bun x node-gyp`, which selects the latest version outside the lockfile. Concurrent native builds can race while that executable is being downloaded. PR #706's macOS desktop job failed this way while installing `fs-xattr` and `macos-alias`.

A local isolated-install fixture confirms that the fallback selects 13.0.2 even when the workspace declares 12.2.0. Declaring the build tool at the root alone cannot enforce its version in this layout.

Clean macOS CI also shows that Bun can start native scripts before it creates the root build-tool link.

Bun also replaces an existing bin link by deleting it and creating it again. Every install relinks the root package's bins, and it does not wait for workspace native scripts that already run. A script that finds `node_modules/.bin/node-gyp` in `PATH` just before Bun deletes it fails with exit code 127. Linux CI failed this way on 2026-09-26 in runs 36263880127 and 36264944007. Under CPU load, a Linux container failed 16 of 6,400 fixture installs the same way. `strace` shows the second install calling `symlinkat`, which fails with `EEXIST`, then `unlinkat` and `symlinkat` again on that link.

## Temporary workaround

As a temporary workaround, the CI native-dependency installer first installs the root workspace and its build tools with a workspace filter. It then deletes the root `node_modules/.bin` directory from that install, installs all workspaces, and sets `npm_config_node_gyp` to the root package's executable. Bun's own fallback wrapper supports this setting. Installation still runs all trusted lifecycle scripts with the frozen lockfile. The setting is scoped to installation so Electron packaging can select its own build tool and runtime headers.

The extra filtered install prepares the build tool before dependent workspaces run scripts. It adds a second lockfile check, but keeps dependency versions frozen and lifecycle scripts enabled in both phases.

Deleting the root bin links makes the second install create each one once instead of replacing it. Creating a symlink is atomic. A native script that starts before Bun links the root bins misses the link and reaches Bun's wrapper, which is last in `PATH` and runs `npm_config_node_gyp`. A later script finds the finished link. Bun keeps the root `node_modules/node-gyp` link when its target has not changed, so the wrapper's path stays valid for the whole install. The same container load test passed 6,400 of 6,400 installs with this change.

The root bins are missing for a moment during the second install. Only `node-gyp` has a Bun fallback, and native builds need no other root bin. On Windows, Bun writes bin shims as `.exe` and `.bunx` files, and writing a new file is not atomic. No Windows native dependency runs node-gyp today.

Leaving the root out of the second install with `--filter '!<root>'` would also keep the root links untouched. It was rejected because Bun then points 81 fallback links in `node_modules/.bun/node_modules` at different versions than a normal install does.

A regression test installs a real isolated workspace dependency and checks the version its install script executes. A slow root dependency holds back Bun's root bin linking until the workspace script has started. The test then checks that the script never saw a root link that the install replaced later.

The user approved a 30-second limit for this regression test on 2026-09-26. A fresh Windows runner fetches about 53 registry metadata files for the real install and exceeded Bun's 5-second default twice. A local stand-in hides the fallback race, and seeding the lockfile still fetches metadata. Keep the real install; the larger limit covers its network work without changing other unit-test limits.

## Removal

Remove this setting when Bun resolves the workspace build tool from isolated dependency scripts without a fallback download. Remove the bin deletion sooner if Bun starts replacing bin links atomically. Keep the regression test and verify clean macOS desktop and release installs before removal.

References:

- [Bun's node-gyp fallback wrapper](https://github.com/oven-sh/bun/blob/main/src/install/PackageManager.rs).
- [Bun's bin link replacement](https://github.com/oven-sh/bun/blob/bun-v1.4.2/src/install/bin.rs), in `create_symlink`.
