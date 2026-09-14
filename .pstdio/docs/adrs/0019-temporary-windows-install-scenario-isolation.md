# Temporary Windows install scenario isolation

## Intended behavior

Integration tests must exercise installation, validation, and source replacement under the same filesystem rules as the shipped Bun runtime.

## External limit

With Bun 1.3.14 on Windows, an extension replacement scenario fails with EPERM inside `bun test` after loading dependencies. The identical scenario succeeds under `bun run`, including with active filesystem watchers. Moving only validation into a worker does not fix the test-runner failure.

## Temporary workaround

Run installation and startup-refresh integration scenarios in ordinary Bun subprocesses. Assert their exit status and retain assertions inside each scenario. Keep scenarios next to their tests. Run the same subprocess tests on every platform so CI exercises one test design.

This adds process startup cost but keeps production installation unchanged. Do not increase test or CI timeouts. Keep ordinary unit tests in the test runner.

## Removal

Move these scenarios back into the test process when the supported Bun version passes the same Windows source-replacement regression in `bun test`.
