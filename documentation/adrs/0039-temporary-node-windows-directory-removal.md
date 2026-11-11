# Temporary Node Windows directory removal

Proposed: 2026-09-26

Status: Accepted as a temporary workaround.

## Intended design

Packaged tests stop their processes, wait for runtime termination, and remove their
temporary homes. Node's directory removal must honor its documented retry options
when Windows briefly retains a file or directory handle. Either filesystem API
should provide this behavior without an application retry loop.

## External limitation

Native run 36161700264 (run no longer on GitHub)
uses Node 24.20.0. Three homes fail synchronous removal with `EPERM, Permission
denied` after their runtime has terminated. Failure returns in about 120 ms even
though the fixture requests five retries with a 100 ms linear delay.

Node's [synchronous implementation](https://github.com/nodejs/node/blob/v24.20.0/src/node_file.cc#L1748-L1853)
maps Windows `permission_denied` to `EPERM` after excluding it from the retry set.
Its Windows delay also divides milliseconds by 1000 before calling `Sleep`, which
already takes milliseconds. Our delays therefore round to zero.

We cannot repair Node's installed native implementation in this repository.
Waiting for the runtime remains necessary, but cannot repair this upstream retry
contract or account for temporary OS handles after termination.

## Temporary workaround

Use Node's built-in asynchronous `fs.rm` on Windows in the packaged-home cleanup. Its
[implementation](https://github.com/nodejs/node/blob/v24.20.0/lib/internal/fs/rimraf.js#L28-L59)
handles Windows permission errors and uses millisecond timers. Keep the existing
`recursive`, `force`, `maxRetries: 5`, and `retryDelay: 100` options. Await removal
and propagate its final error. Do not add retries, increase a test limit, ignore
failed deletion, or change product runtime behavior.

This is a temporary workaround for the upstream synchronous API, isolated to test fixtures. Cleanup yields while Windows releases handles instead of
blocking the test worker. Tests still cannot finish before their home is removed.

POSIX keeps native synchronous traversal with the same removal options. Native
macOS ARM64 run 42171037317 reached the transport assertions, then spent 17.754s
removing its home and exhausted the unchanged 45s allowance. In a local Node 24
diagnostic, removing copies of an actual 856MB E2E home took 841ms through the
asynchronous traversal and 277ms through the synchronous traversal. This local
comparison motivates the change; native CI must still establish completion within
the existing allowance. Cleanup continues to await complete deletion and propagate
errors on every platform.

The Bun-run CLI fixtures own a platform removal utility directly: `/bin/rm -rf`
on POSIX and `cmd.exe /d /v:off /c rmdir /s /q` on Windows. The root is a literal
argument on POSIX and a quoted, single-expanded environment value on Windows.
Directory links are not traversed. Each case stops its runtime first, awaits full
removal and propagates failure. No deletion workers or test time limits are added.

[Release verification 42962479744](https://github.com/pufflyai/prompt-studio/actions/runs/42962479744)
finished five Apple Silicon Planner scenarios' assertions in 16–23 seconds, then
exhausted their unchanged 30-second allowances in Node native traversal. One
completed removal took 14.899 seconds. Windows Auto Build stopped its runtime at
22.333 seconds and also exhausted 30 seconds during removal. This supersedes the
single Node synchronous fast pass introduced during the earlier qualification.

The utility is the runner-owned child, rather than a grandchild hidden behind a
synchronous Node call, so cancellation stops traversal. Only a normal Windows
utility failure admits one Node asynchronous removal with the existing five
retries and 100ms delay. Signal termination and cancellation never start recovery.
Native timing qualification remains necessary; local link-safety tests alone do
not prove completion on a hosted runner.

The command-discovery fixture uses the same asynchronous removal policy after
[Windows run 40010409328](https://github.com/pufflyai/prompt-studio/actions/runs/40010409328/job/120620966481)
completed its real Node shim assertions but failed synchronous cleanup with `EBUSY`
on its copied executable. That Bun test failure establishes a transient file lock;
it does not establish that Bun shares Node's implementation defect. Keep the same
retry values, await removal, and propagate the final error.

The source-default refresh scenario follows this policy after
[Windows run 40024366194](https://github.com/pufflyai/prompt-studio/actions/runs/40024366194/job/120656896879)
finished its refresh assertions and awaited application shutdown, then failed
synchronous temporary-directory removal with `EPERM`. Application shutdown already
awaits startup background tasks. The fixture still propagates exhausted cleanup.

## Removal

Recheck the upstream implementation when the CI Node version changes. Once both
permission-error retries and millisecond waits are fixed, run the transient-handle
regression and the full native Windows suite with synchronous removal. Remove the
workaround and this constraint only when that evidence passes with unchanged limits.
