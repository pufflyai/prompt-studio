# Remote execution and automation

Prompt Studio keeps remote provider protocols inside extensions. The core host owns workspace and run state, authentication, secret storage, request policy, and audit records.

## Remote workspace flow

1. A workspace type provider creates or resolves a workspace through a named connection.
2. The host stores the provider id, opaque provider reference, provider state, capabilities, and `execution_kind = remote`.
3. A compatible harness declares `cwdRequirement: "optional"`.
4. Session start, resume, reattach, and message reads receive the same remote execution target.
5. The harness uses its host-managed connection to call the remote control plane and streams neutral session patches back to Prompt Studio.

Remote session starts use the stable Prompt Studio session id as the provider idempotency and correlation key. Follow-ups use a stable request id. A provider must deduplicate these requests and support cleanup by the known remote session id, including when cancellation arrives after acceptance but before the response reaches the host.

The host does not invent a local path for a remote workspace. Local file and terminal APIs stay absent. Provider credentials never enter the provider reference, workspace record, extension settings, command input, child-process environment, or logs.

## Named connection boundary

A connection contribution declares its allowed HTTP methods, path prefixes, authentication shape, and streaming support. Project settings hold only the base URL and an opaque secret reference. The credential lives in the host secret store. The request proxy enforces same-origin relative paths, HTTPS outside loopback, bounded request and response sizes, timeouts, cancellation, and no redirects.

The default desktop implementation uses the temporary file store documented in [ADR 0013](../adrs/0013-temporary-file-connection-secret-store.md). Hosted deployments should inject their deployment secret provider through the same interface.

## Machine request flow

1. A runtime-authenticated user issues a token for one project and exact automation-enabled command ids.
2. The host returns the raw credential once and stores its scrypt digest.
3. The caller sends the machine credential, an `Idempotency-Key`, and command input.
4. The host verifies expiry, revocation, project scope, command scope, and the command's declared params.
5. The host stores the queued run and its first event in one transaction before starting the normal extension command runner. Every later status transition and its matching event use the same transaction rule.
6. Status and event reads require the same principal and command scope.

Idempotency is scoped by principal, project, command, and key. The host hashes canonical input. The same key and input returns the existing run; different input returns `409 idempotency_conflict`. The default rate limit is 60 new runs per principal and project per minute.

Principals belong to one project and are removed with that project. Credential rotation issues a new token for the same principal, so retries made with the replacement token keep the existing idempotency history. A principal from another project is rejected.

Queued work starts again after restart. An idempotent retry also restarts an existing queued run if its earlier in-process launch was interrupted. Work interrupted after it reached `running` becomes a retryable `host_restarted` failure. The caller may submit a new logical request with a new idempotency key.

Cancellation aborts the command environment before the run becomes terminal. The signal reaches workspace creation, session scheduling, harness work, and connection requests. If a remote provider accepts a workspace after cancellation, the host calls the provider's `cancel` or `delete` method before it marks the workspace cancelled. Public cancellation and shutdown both stop waiting after a bounded grace period when extension code ignores the signal. A timed-out public cancellation returns `409 automation_cancellation_pending` and leaves the durable run nonterminal until execution cleanup settles.

Terminal runs, validated inputs, bounded results, and their events are retained for 30 days. The host prunes them at startup. Token records remain available for revocation and audit until their project is deleted.

## Deployment and threat model

Internet-facing deployments must terminate TLS before the Prompt Studio API and restrict normal runtime routes to the trusted dashboard origin. Only `/v1/projects/{projectId}/automation-runs...` accepts machine credentials. Machine credentials are rejected on all other routes.

The design limits these threats:

- A stolen token is limited by project, exact command ids, expiry, revocation, and rate limits.
- A malicious extension cannot read stored connection credentials. It can only send requests allowed by its declared connection policy.
- A caller cannot use a connection as a general proxy because paths are relative, origins cannot change, and redirects are rejected.
- Duplicate webhooks cannot duplicate accepted work when they reuse their stable idempotency key.
- Denied valid-token scope attempts create an activity record without storing the credential.

Operators must still protect the host account, storage root, deployment secret provider, and TLS boundary. A process with full access to the Prompt Studio host has the same trust as the host itself.
