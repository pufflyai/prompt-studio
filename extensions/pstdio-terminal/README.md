# Terminal

The default Terminal tool opens native shells in the project folder or selected ready local workspace. It owns the Open terminal command, workspace menu action, terminal names, search results and Bottom placement. Tabs can move to Main or Side and remain alive while hidden. Closing a tab or disabling the extension ends its owned PTY; re-enabling the extension opens fresh shells.

The extension requires the public native terminal surface in extension API 0.4.0. It pins published `@pstdio/sdk@0.47.0-nightly.20261111030243`; the matching released host is `0.47.0-nightly.20261111030243`. These versions contain the required contracts. Installed-consumer qualification against that released host remains required before adoption. This package is independently versioned.

Legacy host commands delegate to this tool. Saved terminal tabs preserve their names, workspace references and chosen regions through the host migration. A restarted host starts fresh shells; saved tabs never imply restored processes.

Use `pst pstdio.pstdio-terminal open` or `pst pstdio.pstdio-terminal open-workspace --workspace-id <id>`. Headless invocations return the resource and navigation intent; a dashboard caller opens the native view. For development, run `pst extensions dev <source>` in an isolated compatible host, then test `pst extensions add <source> --force` with package-local public dependencies.
