# Remote automation

Remote services can run extension commands in a project with a machine token.

A token is limited to one project, an exact list of command IDs, and an expiry time. Only commands that opt in with `automation: true` can be added to a token.

These examples assume your enabled `acme.remote` extension provides a `launch`
command with `automation: true` and a `ticketId` parameter. Replace that command
ID with your provider's published ID. Planner's normal workflow commands do not
opt into remote automation automatically.

Issue a token with the normal Prompt Studio runtime credential:

```sh
pst auth tokens issue \
  --name notion-ticket-trigger \
  --project project-id \
  --command acme.remote.command.launch \
  --expires-in 30d
```

The raw token is shown once. Store it in the calling service's secret store. Prompt Studio stores a slow hash, not the raw token.

Each token acts as a principal, the identity that owns its runs. Idempotency keys are tracked per principal. To replace a token and keep its idempotency keys, issue the new token for the same principal:

```sh
pst auth tokens issue \
  --name notion-ticket-trigger-rotated \
  --project project-id \
  --principal principal-id \
  --command acme.remote.command.launch \
  --expires-in 30d
```

The principal must belong to the same project. Revoke the old token after the caller has switched to the replacement.

Set the token for machine commands:

```sh
export PSTDIO_AUTOMATION_TOKEN='pst_at_...'

pst automation run \
  --project project-id \
  --command acme.remote.command.launch \
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

The host accepts at most 60 new runs per principal and project each minute by default. Set `PSTDIO_AUTOMATION_RUNS_PER_MINUTE` to change the limit. Idempotent retries do not consume another run. Accepted runs are stored before execution. Queued runs resume after a host restart. A run that was executing when the host stopped fails with a retryable `host_restarted` error, because extension commands cannot resume halfway. Terminal runs and their events are retained for 30 days and pruned at startup and during new-run admission.
