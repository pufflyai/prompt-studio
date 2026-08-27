# Remote automation

Remote tools call only extension commands that opt in with `automation: true`. A machine token is limited to one project, an exact list of command ids, and an expiry time.

Issue a token with the normal Prompt Studio runtime credential:

```sh
pst auth tokens issue \
  --name notion-ticket-trigger \
  --project project-id \
  --command pstdio.planner.command.start-attempt \
  --expires-in 30d
```

The raw token is shown once. Store it in the calling service's secret store. Prompt Studio stores a slow hash, not the raw token.

To rotate a credential without changing its idempotency namespace, issue the replacement for the existing principal:

```sh
pst auth tokens issue \
  --name notion-ticket-trigger-rotated \
  --project project-id \
  --principal principal-id \
  --command pstdio.planner.command.start-attempt \
  --expires-in 30d
```

The principal must belong to the same project. Revoke the old token after the caller has switched to the replacement.

Set the token for machine commands:

```sh
export PSTDIO_AUTOMATION_TOKEN='pst_at_...'

pst automation run \
  --project project-id \
  --command pstdio.planner.command.start-attempt \
  --idempotency-key notion-page-123-revision-7 \
  --input '{"params":{"ticketId":"PS-294"}}'
```

Use one stable idempotency key for one logical request. Repeating the same key and input returns the original run. Reusing the key with different input returns a conflict.

Inspect or control a run:

```sh
pst automation status --project project-id --id run-id
pst automation events --project project-id --id run-id --after 0
pst automation watch --project project-id --id run-id
pst automation cancel --project project-id --id run-id
```

List and revoke credentials with `pst auth tokens list --project project-id` and `pst auth tokens revoke --id token-id`.

The host accepts at most 60 new runs per principal and project each minute by default. Idempotent retries do not consume another run. Accepted runs are stored before execution. Queued runs resume after a host restart. A run interrupted while its command is executing becomes a retryable `host_restarted` failure because extension commands do not have a general resume contract. Terminal runs and their events are retained for 30 days and pruned at startup and during new-run admission.
