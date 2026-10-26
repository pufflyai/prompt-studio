# Temporary native Edge for Windows ARM dashboard smokes

Proposed: 2026-10-26

Status: Proposed pending final native qualification

## Intended design

Packaged dashboard functional tests should run on a Chromium-family browser built for the runner's architecture. Browser provisioning and interruption tests must exercise the browser that the product installs. Performance benchmarks keep their declared browser and workload.

## External limitation

[Playwright 1.60's browser registry](https://github.com/microsoft/playwright/blob/v1.60.0/packages/playwright-core/src/server/registry/index.ts) provides Windows Chromium as `win-x64`, including on Windows ARM. There is no native Windows ARM Chromium artifact to select through that installation path. Prompt Studio cannot fix the upstream artifact set.

In [comparison run 40266908057](https://github.com/pufflyai/prompt-studio/actions/runs/40266908057), the launched provisioned Chromium executable was x64 on an ARM64 host. Three dashboard cases exceeded their existing 30-second allowances. The same cases passed with the installed ARM64 Edge executable. The comparison changes browser version as well as architecture; it does not isolate emulation as the sole cause of the slower runs.

## Decision

Use Playwright's [supported `msedge` channel](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge) for the board, chat motion, saved view ordering, and core workspace selection functional smokes on Windows ARM. Use provisioned Chromium elsewhere. Keep this choice in one shared launch-options export. Missing Edge is a failure, with no skip or fallback.

Keep the same headless mode, contexts, viewport, authentication, cold application navigation, ticket actions, streaming responses, history checks, reloads, and 30-second allowances. The comparison passed all four cases in 27.55, 24.81, 15.20, and 20.72 seconds. The actual launched executable's PE header and Visual Studio `dumpbin` output identify ARM64. [Engine verification run 40268369505](https://github.com/pufflyai/prompt-studio/actions/runs/40268369505) also decoded the engine matching the exact CDP product version, `156.0.4314.42`, as ARM64. Final qualification must still pass on the delivered revision.

Product browser installation, lifecycle, and interruption tests keep `PROVISIONED_CHROMIUM`. Benchmarks keep their existing browser. This is a temporary test infrastructure workaround, isolated from product browser selection.

## Limitations

Windows ARM dashboard smokes depend on a native Edge installation. Edge updates independently of Playwright's bundled Chromium. The fixture choice provides native functional coverage but does not establish a comparative browser performance contract.

## Removal

When Playwright supplies native Windows ARM Chromium, verify the actual executable and engine architecture, run the unchanged cold functional workloads on both Windows architectures, and remove the platform-specific launch option. Do not remove this workaround based only on a directory name or user-agent string.
