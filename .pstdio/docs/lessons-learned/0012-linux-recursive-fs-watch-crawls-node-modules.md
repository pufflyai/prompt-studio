# Recursive `fs.watch` on Linux crawls node_modules symlinks and hangs CI

## What went wrong

GitHub Actions "Test and Build" hit the 15-minute job timeout on most runs since late May, while `bun run validate` passed locally every time. The lerna/nx log showed every package's test target completing — except `pstdio-api:test`, which never printed a completed group. Attempts to reproduce in Docker on macOS produced out-of-memory errors instead of a hang, which looked like a different failure but was the same root cause in a smaller memory budget.

Because nx buffers task output until completion, the hanging task produced no output at all, and the cancelled job log was easy to misread: the last visible lines were another package's green test summary.

## Why

API tests that enable real repo extensions (for example `core-extension-catalog.test.ts` enabling `extensions/pstdio-planner`) start the extension source watcher, which called `fs.watch(source_path, { recursive: true })`.

- On macOS, recursive `fs.watch` maps to FSEvents: registration is O(1) and never walks the tree, so the watcher is effectively free locally.
- On Linux there is no native recursive watch, so the runtime crawls the tree and registers every directory. `extensions/pstdio-planner/node_modules` contains symlinks straight into the monorepo's root `.bun` store (`lucide-react -> ../../../node_modules/.bun/lucide-react@...`), and the crawl follows them — into hundreds of thousands of files.

A diagnostic workflow that dumped process state at hang time showed the `bun test` process ten minutes in: one core pegged, ~4 GB RSS, more than 10,000 open file descriptors, still opening `lucide-react/dist/esm/icons/*.js(.map)` under the `.bun` store, plus directory fds held on already-deleted test fixtures. The `.gitignore`-based ignore matcher only filtered *events*, not what got registered — and the planner extension has no `.gitignore` at all.

The earlier fix that stopped a dangling `node_modules` symlink from crashing the watcher was this same crawl surfacing differently.

## How it was solved

- A temporary `debug/api-test-hang` workflow reran the failing step under a watchdog and, on hang, dumped `ps auxwwf`, per-pid cmdline/cwd/fd tables, and kernel thread stacks. The fd table named the mechanism precisely.
- On Linux, the [source watcher](../../../packages/pstdio-api/src/features/extensions/extension-source-watcher.ts) walks the source tree and registers non-recursive watches. It skips dependency contents, `.git`, ignored directories, and symlinked directories. Separate shallow watches on `node_modules` and scope directories detect package replacement without crawling installed packages.
- macOS and Windows use native recursive notifications from the source root.
- Regression tests cover excluded directory contents, dependency replacement, and source-directory replacement.
- Verified by rerunning the previously hanging step on CI: the non-e2e test step completes in ~3.5 minutes.

## Key takeaways

- Recursive `fs.watch` is a different feature per platform: free on macOS (FSEvents), a full-tree crawl on Linux. Never point it at a tree that can contain `node_modules` — in a bun workspace, package-local `node_modules` symlinks back into the monorepo store, so a "small" extension folder transitively reaches everything.
- Filtering watch *events* through an ignore matcher does not limit what gets *registered*. Registration itself must skip ignored directories.
- For CI-only hangs, stop guessing and capture ground truth in CI: a watchdog that dumps the process tree, fd tables, and thread stacks at hang time identifies the culprit in one run. Open fds on unexpected paths (here: an icon library's sourcemaps) are a high-signal clue.
- When CI runs are `cancelled`, classify them by duration first: a constant duration just under the job timeout means a hang, not flaky cancellation.
- A macOS Docker reproduction that fails with memory errors instead of hanging can still be the same bug — an unbounded crawl OOMs in a small cgroup before it has time to look stuck.

## Earlier false lead

The last visible green summary came from `pstdio-db:test`, which initially led the investigation toward Bun's parallel worker path. Removing its custom runner and using direct `bun test --silent` simplified that package, but did not fix the API watcher crawl. Do not identify a hung target from the last printed summary: confirm which command is still running, especially when Nx buffers task output.
