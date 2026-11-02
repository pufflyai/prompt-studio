# Bound watcher registration on each platform

## 1. When to use

- Adding file watchers, extension reloads, or directory replacement handling.

## 2. Failure

- Linux recursive watching followed dependency symlinks into the monorepo store, consuming CPU, memory, and thousands of file descriptors.
- Filtering events did not limit registration. Buffered Nx output made another package's last green summary look responsible.

## 3. Prevention

- Use the shared directory-tree watcher instead of adding another recursive crawl.
- Exclude dependency contents, ignored directories, and symlinked directories during registration.
- On Linux, keep source watches non-recursive and dependency-replacement watches shallow. macOS and Windows use native recursive notifications.
- Preserve coverage for source removal, replacement, and dependency replacement.
- Diagnose hangs from the running process, open file descriptors, and resource use; the last printed summary may belong to another task.

## 4. Evidence

- [Source watcher](../../packages/pstdio-extensions/src/authoring/extension-source-watcher.ts)
- [Directory-tree watcher](../../packages/pstdio-extensions/src/fs-watch/directory-tree-watcher.ts)
