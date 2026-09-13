# Temporary native build tool selection

Native dependency installation should use the workspace's locked `node-gyp` version.

Bun 1.4.2's isolated dependency layout does not expose the root build tool to every dependency script. Bun falls back to `bun x node-gyp`, which selects the latest version outside the lockfile. Concurrent native builds can race while that executable is being downloaded. PR #706's macOS desktop job failed this way while installing `fs-xattr` and `macos-alias`.

A local isolated-install fixture confirms that the fallback selects 13.0.2 even when the workspace declares 12.2.0. Declaring the build tool at the root alone cannot enforce its version in this layout.

As a temporary workaround, the CI native-dependency installer sets `npm_config_node_gyp` to the root package's executable. Bun's own fallback wrapper supports this setting. Installation still runs all trusted lifecycle scripts with the frozen lockfile. The setting is scoped to installation so Electron packaging can select its own build tool and runtime headers.

This depends on the root build-tool package being available when dependency scripts run. A regression test installs a real isolated dependency and checks the version its install script executes.

Remove this setting when Bun resolves the workspace build tool from isolated dependency scripts without a fallback download. Keep the regression test and verify clean macOS desktop and release installs before removal.

Reference: [Bun's node-gyp fallback wrapper](https://github.com/oven-sh/bun/blob/main/src/install/PackageManager.rs).
