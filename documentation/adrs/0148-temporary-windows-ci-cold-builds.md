# Temporary Windows CI cold builds

Proposed: 2026-11-13

Status: Accepted for implementation. Native cold-build qualification remains required.

## Context

Windows API job 131896525349 in run 43426507861 built all five selected projects successfully, then Nx exited with a loopback HTTP cache request error. All 72 selected test files subsequently passed. The optional cache turned completed build work into a failed job.

Ideally, a cache transport failure would leave successful build results intact. Nx 22.5.4 instead makes this request failure fatal. The retained job does not establish why the cache connection failed; its server log was not uploaded. Changing timeouts, ignoring the build exit code or retrying the same job would hide that uncertainty.

## Decision

Set the supported `NX_SKIP_REMOTE_CACHE=true` flag on Windows CI jobs. Do not restore portable HTTP cache archives or start their server there. Keep normal dependency installation, local per-job Nx caching, build targets, tests and all existing limits. Other platforms retain the HTTP cache.

This is a temporary isolation of an optional optimization, not a repair of the underlying socket failure. No build or test failure is converted to success.

## External limitation

The configured Nx HTTP cache client can fail the command after all build tasks succeed. Its transport failure is external to those tasks. We cannot infer a safe server repair from the available log, so the supported client opt-out removes that dependency on the affected platform.

## Limitations

Windows jobs build from cold outputs and can take longer. The unchanged 25-minute API job allowance still applies. The original failed job remains red. A focused native build must prove that the same five targets finish with the new configuration; it does not qualify unrelated tests again.

## Removal

Restore Windows HTTP caching after a cache-client or server repair has a deterministic transport-failure regression and native evidence that successful tasks remain successful when cache transport fails. Remove the flag and platform conditions together. Do not restore caching merely because an unchanged retry passes.
