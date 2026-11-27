# Temporary operator bootstrap for the Cloud team harness

Proposed: 2026-11-27
Status: Accepted — temporary test-only workaround; implementation qualification pending.

## External limitation

The first committed-source automatic run exposed an operator CA refresh race; that
wrapper was repaired with atomic replacement while retaining certificate validation.
The next run provisioned two healthy Cloud Workspaces, but the controller did not deliver
one submitted generic test command: its native session service remained healthy, its
execution receipts/source folder stayed empty, and removing the run's added network
policy did not start it. The other workspace ran normally. The original run and cleanup
evidence are retained in RP-912. This does not establish a general controller root cause.

## Decision

For this local harness, provision and reserve through the existing Cloud Workspaces companion with a bounded holder request,
then copy an immutable Git archive into `/workspace/cloud-team/repo` and bootstrap the app through the configured operator's
Kubernetes transport. This avoids depending on generic test-request dispatch for a
long-lived application daemon. It adds no controller, product or authentication changes.

Only a clean committed source revision is accepted. Credentials stay outside the archive.
Each workspace keeps its own home/database/device. Per-run policies admit only explicit
peers; a finite owned Job deadline and worker deadline bound process lifetime. The local
runner records each workspace before copying or starting it and stops only its resources.
The holder request uses the companion-owned `/workspace/repo`, so late dispatch cannot replace the live app source. Its normal project-scoped claim excludes ordinary reuse. Check that reservations still exist before accepting a result, and refuse cleanup if another run has claimed a workspace. The holder uses stopAfterRun=true. Cleanup cancels and waits for that exact run; its normal collector stops before releasing ownership. Never release then call the unguarded environment-stop command. The source/bootstrap log stays in that owned pod; sanitized results stay in private local
evidence. No result is inferred from Kubernetes provisioning alone.

The next attempt encountered a full compute pool and lost its long CLI HTTP response before a holder ID returned. The local harness therefore uses the same public host command endpoint with Bun's idle timeout disabled and its own finite 20-minute request allowance. It journals a unique holder marker before submission; an interrupted response must be recovered from that exact marker or cleanup remains explicitly uncertain and retains storage. No production server timeout or companion installation is changed. The installed companion does not expose its initial run to machine automation, so this does not add automation permissions or issue a new token.

## Limitations

The companion has no nonblocking exact-run inspection command; its recent-run list is
bounded to 50. Missing entries are never treated as proof that a busy workspace is free.
The harness refuses verification or cleanup when it cannot positively identify its active
holder. This may require operator cleanup for a retained pair displaced from that projection;
it must not silently stop an unknown claim. A future exact reservation read should remove
this conservative limitation.

## Removal

Owner: PS-1373 implementation/qualification. Remove this operator bootstrap when the
companion provides a documented app-daemon lifecycle or the same submitted-command
path is diagnosed and qualifies two clean simultaneous runtimes without manual repair.
Compare both lifecycle paths using this harness's complete scenario and cleanup; never
substitute a controlled relay peer or disable TLS verification to obtain a pass.
