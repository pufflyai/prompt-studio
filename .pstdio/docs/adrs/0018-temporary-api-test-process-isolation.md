# Temporary API test process isolation

## Intended behavior

Each API test file owns its fixtures and releases them when it finishes. The test runner must release the file's module state, including closed PGlite instances, before loading more files. Extension imports must finish top-level asynchronous initialization before their exports are read.

## External limit

Bun 1.3.14 keeps enough state across the full API suite to exceed 11 GiB and be killed by the operating system. Closing the twelve fixtures that discarded their app handle fixes those leaks but does not bound the full process. The low-memory runtime mode also keeps growing.

Bun's built-in `--isolate` completes the suite but still approaches 10 GiB. It also breaks the existing skill-service fixture's dynamic import with `Cannot access 'default' before initialization`. The same fixture imports correctly without that mode. Changing the fixture to avoid top-level await would hide a supported extension behavior.

The reproduction logs are in the [implementation report](../../reports/workbench-sdk-revision/report.md). These limits prevent using Bun's built-in file isolation for this suite today.

## Temporary workaround

Run each API test file in a fresh Bun process, with at most two files running at once. Retain the existing per-test timeout and normal import conditions. A file failure fails the whole command. This replaces the previous special invocation for the workspace-diff file.

The driver is limited to the API package's test command. It adds process startup cost and interleaves two files' output. It does not change the API runtime, extension loading, installed packages, or test assertions. Fixtures must still close their resources explicitly.

## Removal

Remove the driver when the repository's Bun version releases completed file state within the current memory budget and passes the asynchronous skill-import regression with built-in isolation. Run the complete API suite and both release gates before removing it. Do not raise timeouts or alter the fixture's import semantics to satisfy that check.
