# Temporary Node Windows directory removal

## Intended design

Packaged tests stop their processes, wait for runtime termination, and remove their
temporary homes. Node's directory removal must honor its documented retry options
when Windows briefly retains a file or directory handle. Either filesystem API
should provide this behavior without an application retry loop.

## External limitation

Native run [36161700264](https://github.com/pufflyai/prompt-studio/actions/runs/36161700264)
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

Use Node's built-in asynchronous `fs.rm` in the packaged-home cleanup. Its
[implementation](https://github.com/nodejs/node/blob/v24.20.0/lib/internal/fs/rimraf.js#L28-L59)
handles Windows permission errors and uses millisecond timers. Keep the existing
`recursive`, `force`, `maxRetries: 5`, and `retryDelay: 100` options. Await removal
and propagate its final error. Do not add retries, increase a test limit, ignore
failed deletion, or change product runtime behavior.

This is a temporary workaround for the upstream synchronous API, isolated to the
packaged test fixture. Cleanup yields while Windows releases handles instead of
blocking the test worker. Tests still cannot finish before their home is removed.

## Removal

Recheck the upstream implementation when the CI Node version changes. Once both
permission-error retries and millisecond waits are fixed, run the transient-handle
regression and the full native Windows suite with synchronous removal. Remove the
workaround and this constraint only when that evidence passes with unchanged limits.
