# Temporary Chromium-only Playwright bundle

The packaged extension smoke command should bundle its browser client and run without a checkout or node_modules. Browser binaries are provisioned once with the matching Playwright installer.

Playwright 1.60 bundles optional BiDi mapper imports in its core module but does not ship those dependencies. Bun resolves these imports while compiling, including when only Chromium's normal protocol is used. An unmodified compile therefore fails before a browser can launch.

As a temporary workaround, the CLI build marks `chromium-bidi/*` external. The smoke command exposes only Playwright's Chromium launcher. That path does not load the BiDi mapper. A compiled consumer test must launch Chromium and exercise the production dashboard without workspace modules.

This exclusion is confined to the two CLI compilation scripts. It does not replace the browser transport or require an external JavaScript runtime. Other browser engines and BiDi are unsupported by this command. Remove the exclusion when upstream splits optional mapper imports or Bun can omit unreachable imports; prove the compiled consumer tests still pass before removal.
