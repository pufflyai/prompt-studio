# Temporary native build tool selection

Native dependency installation should use the workspace's locked `node-gyp` version.

Bun 1.4.2's isolated dependency layout does not expose the root build tool to every dependency script. Bun falls back to `bun x node-gyp`, which selects the latest version outside the lockfile. Concurrent native builds can race while that executable is being downloaded. PR #706's macOS desktop job failed this way while installing `fs-xattr` and `macos-alias`.

A local isolated-install fixture confirms that the fallback selects 13.0.2 even when the workspace declares 12.2.0. Declaring the build tool at the root alone cannot enforce its version in this layout.

Clean macOS CI also shows that Bun can start native scripts before it creates the root build-tool link.

As a temporary workaround, the CI native-dependency installer first installs the root workspace and its build tools with a workspace filter. It then installs all remaining workspaces and sets `npm_config_node_gyp` to the root package's executable. Bun's own fallback wrapper supports this setting. Installation still runs all trusted lifecycle scripts with the frozen lockfile. The setting is scoped to installation so Electron packaging can select its own build tool and runtime headers.

The extra filtered install prepares the build tool before dependent workspaces run scripts. It adds a second lockfile check, but keeps dependency versions frozen and lifecycle scripts enabled in both phases. A regression test installs a real isolated workspace dependency and checks the version its install script executes.

The user approved a 30-second limit for this regression test on 2026-09-26. A fresh Windows runner fetches about 53 registry metadata files for the real install and exceeded Bun's 5-second default twice. A local stand-in hides the fallback race, and seeding the lockfile still fetches metadata. Keep the real install; the larger limit covers its network work without changing other unit-test limits.

Remove this setting when Bun resolves the workspace build tool from isolated dependency scripts without a fallback download. Keep the regression test and verify clean macOS desktop and release installs before removal.

Reference: [Bun's node-gyp fallback wrapper](https://github.com/oven-sh/bun/blob/main/src/install/PackageManager.rs).
