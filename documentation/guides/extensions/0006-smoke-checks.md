# Smoke checks

`pst extensions test` installs an extension into a throwaway Prompt Studio and opens its pages in a real browser, to catch errors before you ship.

## Run a smoke check

Install the browser once, then test a local extension folder:

```sh
pst extensions install-browser
pst extensions test ./my-extension
```

The test installs the source into a temporary home and loads its pages that need no resource in the real dashboard. Browser setup uses the Bun runtime inside the installed `pst` and the matching Playwright version. You do not need a separate Bun, bunx, or Node.js installation. Downloaded browsers are cached and reused.

On Linux, use `pst extensions install-browser --with-deps` when the browser's system libraries are missing too. Installing them may need administrator access. `PLAYWRIGHT_BROWSERS_PATH` selects the browser cache for both setup and test runs.

## Options

Use `--json` to print one machine-readable result on stdout. Logs go to stderr. Use `--keep-home` to keep the temporary run folder and its evidence after all processes stop.

`--project-path <directory>` supplies a project folder for the test. It must contain the source and any local dependencies it refers to by relative path. The test copies it first. Your source files, project configuration, lockfiles, and installed dependencies are never changed. Dependencies install in the copy. Source symlinks and local dependencies with absolute paths are not supported.

## Isolation

The run passes on only the operating system's launch and locale environment variables. Your credentials and other environment variables do not reach extension code, the host, or the browser. Dependencies must install without credentials from your environment. The command keeps processes apart, but it is not an operating-system sandbox.

## Results

The result lists the installed source and its hash, the host and browser versions, how long each phase took, each check, the contributions it visited, and what it did not cover.

| Exit code | Meaning |
| --- | --- |
| 0 | The checks for the initial load passed. |
| 1 | The extension failed at runtime. |
| 2 | Installation or a declaration failed. |
| 3 | The input, setup, or cleanup failed. |

Checks that could not run because an earlier check failed are marked `not-run`. Errors while closing the browser or host still produce a complete result, and the temporary files are still removed.

## What a pass covers

A pass covers registration, the selected pages that need no resource, mounted webviews becoming ready, and errors seen during those steps. A region normally mounts only its active tab, so inactive panels that never mount are listed as not exercised. Host diagnostics come only from dashboard scripts, so extension console output cannot fake a result.

Commands, editors for a specific resource, settings, optional tabs, and behavior that needs clicks require your own tests. Two items may share a display label. An extension without eligible pages passes with zero pages visited. The command never creates resources or runs arbitrary commands.

Chromium support follows Playwright 1.60.0: macOS on arm64 and x64, Windows x64, and supported Linux distributions on x64 and arm64. The browser support loads only for this command.
