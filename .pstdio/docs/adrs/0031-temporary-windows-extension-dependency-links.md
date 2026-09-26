# Temporary Windows extension dependency links

## Intended design

An extension installed from a local workspace can reuse that workspace's dependencies without copying their contents. Backend loading and frontend builds must resolve the same installed packages.

## External limitation

On Windows with Bun 1.4.2, a directory junction to a workspace's `node_modules` does not reliably preserve access through its relative package symlinks. Native run 36175268427 proves that the source React package and `jsx-runtime.js` exist, but `existsSync` and the browser bundler cannot access them through the installed junction. `realpathSync` still resolves their original locations. Lab consequently has no frontend bundle.

## Temporary workaround

Reuse the runtime loader's existing dependency mirror in the installer. Create a real `node_modules` directory and link each package to its resolved source location. Scoped packages get their own links. This retains shared dependency contents and removes the extra junction above relative package links.

The shared helper owns this workaround; the frontend builder needs no platform branch, fallback source tree, or separate dependency cache. Installation creates more directory entries but does not copy package trees.

## Removal

Remove this workaround when the supported Windows runtime can build the real installed Lab entry through the original directory junction. Keep the native packaged Lab assertion and linked-package smoke checks as the removal gate. Do not replace resolved package links with a directory junction until those checks pass on Windows.
