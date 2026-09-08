# Temporary packaged debugger attachment order

## Intended design

Packaged Electron tests should attach their debugger during startup, capture the
lifecycle view, and disconnect after the app exits. A persistent runtime must
remain independent of that debugging connection.

## External limitation

On Linux with Electron 43.3.0 and Playwright 1.60.0, the ownership/relaunch test
waits indefinitely in `browser.close()` after Electron has exited. The native
process exits in 51 ms and the persistent runtime answers its health request in
11 ms. The Playwright debugging connection does not finish closing.

The failure is recorded in [the native CI job](https://github.com/pufflyai/prompt-studio/actions/runs/34135734303/job/101786129293).
Its artifact records the completed quit, process-exit, and health-check steps.
The connection was established before Electron spawned the runtime. An inherited
debugging socket is the suspected cause. A separate container reproduction could
not run Electron's sandbox because the container denied namespace creation. The
socket inheritance hypothesis remains unconfirmed; native CI must verify this
ordering change.

## Temporary workaround

Wait for the runtime descriptor before opening the Playwright CDP connection.
The runtime process then exists before the debugger connection is created.
Keep measuring readiness from the original application spawn time and preserve
the existing timing limits and all ownership/relaunch assertions.

The change stays in the packaged test launcher. It adds no application state,
runtime flags, timeout increase, or alternate shutdown path. The trade-off is
that this test connection starts tracing after runtime startup. The source
Electron suite continues to cover the initial lifecycle renderer.

## Removal

Remove this ordering constraint when the original attach-before-spawn sequence
can disconnect promptly after Electron exits on Linux while its persistent
runtime stays alive. Re-run the packaged ownership/relaunch test on native CI
and retain its timing and trace evidence before removing the workaround.
