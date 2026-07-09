# @pstdio/workbench

## 0.2.0

_2026-07-09_

### Minor Changes

- eeaaef2: Publish the workbench as a standalone, self-contained `@pstdio/workbench` package. The build inlines its private workspace dependencies (`pstdio-extensions`, `pstdio-api-contracts`) and externalizes shared peers (`react`, `@pstdio/sdk`, `@pstdio/ui`, Chakra), so external apps can build a workbench host and mount extension webviews. Adds a `./webview-runtime` entry point that serves the inlined guest runtime bundle.

### Patch Changes

- Updated internal dependencies: `@pstdio/ui@0.16.0`, `@pstdio/sdk@0.15.0`
