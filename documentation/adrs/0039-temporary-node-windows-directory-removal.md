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
on POSIX and `cmd.exe /d /v:off /s /c rmdir /s /q` on Windows. The root is a literal
argument on POSIX and a quoted, single-expanded environment value on Windows.
Directory links are not traversed. Each case stops its runtime first, awaits full
removal and propagates failure. Test worker counts and execution allowances stay unchanged.

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

The corrected Windows utility invocation in scoped run43002988593 still reached
cleanup at23.244seconds and exhausted30seconds before deletion completed. Partition
only the owned home's installed `extensions` directory into independent immediate
children and remove at most four concurrently, then remove the remaining home.
The parent directory must be a real directory, never a junction or symbolic link.
Do not enumerate extension targets or follow their links. All direct child
processes remain registered with the test's cancellation owner; await all outcomes
before returning or removing the rest of the home. This changes deletion scheduling,
not fresh installation, test operations, assertions or time limits. Two removals
still exhausted30seconds in run43004628763: setup/assertions took26.547seconds
and runtime shutdown completed at26.665seconds, leaving only3.335seconds for
removal. Four independent tasks keep ownership bounded while reducing this last
serial I/O phase; native qualification remains required. POSIX retains
its qualified single traversal.

## Update: bounded independent fixture trees (2026-11-12)

Fresh [ARM native evidence](https://github.com/pufflyai/prompt-studio/actions/runs/43263528704/job/131342738303)
at bf7e913c5 completes every board assertion at 27.152 seconds and closes the
runtime at 27.833 seconds, then exhausts the unchanged 30-second allowance in
removal. The offline-move case closes its runtimes at 26.352 seconds and also
expires in removal. Detailed phase logs identify the remaining-root traversal;
they do not establish which subtree dominates or exonerate setup cost.

Supersede the earlier POSIX single-traversal and Windows extensions-only
scheduling boundaries: partition real immediate directories of the owned root
into one queue, with at most four case-owned native utilities. Windows keeps its
existing immediate installed-package partition in that same queue. Inspect only
real directories; never enumerate symbolic links or junction targets. Fixtures
still stop their runtimes first. Await all sibling outcomes, propagate any error,
and only then remove the remaining files, links and empty parent. Cancellation
never starts a fallback traversal. Keep Node's existing ordinary-error recovery
and retry values unchanged.

This changes deletion scheduling only. It moves no cleanup outside the case,
shares no mutable homes, and changes no functional assertion, workload, worker
count or execution allowance. Real filesystem checks cover multiple sibling
trees, external directory links and hardlinks, a linked extensions root, readonly
and long Unicode paths, and the existing transient-handle behavior. Fresh native
qualification must still demonstrate completion; local passes alone do not prove
a hosted timing improvement.

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
