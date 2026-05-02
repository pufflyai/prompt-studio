---
"@pstdio/sdk": patch
---

Bump `@pstdio/sdk` to `0.4.1` to expose the `./extensions` subpath used by v2 extensions like `extension-lab`.

> **Dev-only bump — not yet on npm.** This version exists in the workspace so that `pstdio extensions add ./extensions/extension-lab` resolves the correct exports against the workspace symlink during development. Until `0.4.1` is published to the registry, end-user installs of extensions that depend on `@pstdio/sdk@^0.4.1` will fail at `npm install`. Publish before announcing the v2 extension flow.
