# Qualify a Microsoft team on Cloud

Run this procedure for PS-1373 in an approved environment with a disposable team, two distinct employee accounts, and isolated devices. Use a minimal private extension and synthetic records, files, and session data. Repeat the business workflow with Onefin only after it approves the tenant and guest policy, participants, and dataset.

## Record the candidate

Record the deployed account-manager and Relay image digests, applied migration versions, HTTPS origins, token issuer and audience, and signing key IDs. Record the desktop version and channel, Cloud extension and SDK/API version, selected package digest, and the team’s Relay entitlement. Check the exact Microsoft Web callback and application registration against the [account-manager guide](0007-account-manager.md#microsoft-web-application-registration). Keep the existing registration across secret rotations.

Use aliases for accounts, devices, and projects in the evidence. Keep credentials, invitation links, personal data, and authorization URLs out of logs and screenshots. Record when each check ran, its result, and the relevant versions. Keep fixture and hosted results distinct.

Confirm the database recovery point and rehearse the upgrade on a disposable team before promotion. Before an image rollback, verify that the previous manager can read every invitation type the candidate wrote. Once the manager accepts Microsoft invitations, use a rollback image that understands those rows. If no such image is available, use the approved database recovery procedure and account for writes after the recovery point. An infrastructure state backup contains Terraform resources, while the database recovery point contains team data. See [portable Cloud deployment](0012-portable-cloud-deployment.md) and [Cloud phase 1 acceptance](0017-cloud-acceptance.md).

## Onboard a colleague

1. Sign in through Cloud settings with two distinct Microsoft accounts from the approved tenant. Exercise consent and any tenant MFA policy, cancel once, retry, then sign out. Repeat after an account-manager restart. Confirm each employee returns to the same account and can enroll a fresh device. Run a Google sign-in and project discovery check against the same candidate.
2. As the owner, create a team with Relay access and sync two projects. In Cloud settings, open **Team members**, select **Microsoft work account**, and enter the recipient’s Entra tenant ID and user object ID from the administrator. The CLI equivalent is `pst teams invite-microsoft <accountId> <tenantId> <objectId>`. Share the link privately. The recipient can accept in their browser before enrolling a Prompt Studio device. Cancel Microsoft consent once and retry from the same invitation page. Before acceptance, try the link with the wrong account and with another provider reporting the same address. Test expiry, cancellation and retry after a lost response. Confirm only the intended account joins, with one roster entry.
3. Check that the colleague sees the team roster and neither project. Grant access to one project. Open it on a clean device and confirm the selected private tool and its enabled dependencies install. Confirm the other project is absent from discovery and denied through its direct link, project APIs, key issuance, and Relay subscriptions.
4. Confirm the two employee devices receive the same shared records and file hashes. Confirm each employee’s private sessions, transcripts, device commands, and folder copies remain inaccessible to the other.

## Collaborate and recover a private tool

Make independent edits on the two devices. Disconnect one device and make another edit while offline. Interrupt an encrypted upload and download during catch-up. Restart the receiving client while it has a backlog. Verify that both devices keep the independent edits and agree on record values and file hashes. Shut down the source device and recover on a clean device. Exercise a representative approved snapshot and a small interactive edit. Record the times for locally saved, waiting, syncing, synced, stale, and failed observations.

Check publication through the UI, command/API, and shared-record write path. A project member without publication authority should be denied when changing the selected code, while an authorized maintainer can publish, enable, disable, uninstall, or roll back. Verify a local development override stays on its own device and leaves the shared revision unchanged.

Keep the last known good package digest. Exercise an incompatible engine, unavailable dependency, interrupted package download and failed activation. Check that the previous usable tool opens. From an authorized device, select the last working digest using `pst extensions publication rollback <extension-id> --revision <package-sha256> --project-id <project-id>`. Verify the selected digest and working tool on both devices. Before a rollback, check whether the old revision can read data migrated by the newer revision. Rollback selects older code and leaves data migrations applied. See [extension publication](../../references/extensions/0002-manifest-and-installation.md#extension-versions-in-cloud-projects).

An extension command can read the signed-in person’s stable Cloud account ID from `(await ctx.account.status()).login?.accountId`. Confirm it differs for the two employees and stays the same across devices for one employee. Device credentials stay in the host.

Configure the named source connection on one authorized company device and leave the colleague’s connection unconfigured. Run `pst extensions automations assign <schedule-id> --device-id <device-id> --project-id <project-id>`, then use `pst extensions automations list --project-id <project-id>` on both devices to verify the assignment. Wait for a scheduled occurrence. Use `pst extensions automations runs --project-id <project-id>` to confirm the occurrence completed on the assigned device and that its run history stays there. Verify that the colleague sees the same timestamped report through the published tool. Record when the source request succeeded and when the new report appeared on each device. See [scheduled automations](../../references/cli/0010-scheduled-automations.md).

Verify that remote commands remain scoped to authorized devices. If employees can request a refresh, exercise that request with their actual permissions and confirm that a rejected request leaves the source untouched.

## Revoke access and hand over the team

First grant the colleague a second project and revoke just that grant. Check the first project still syncs. Then bring the colleague’s device offline and remove the member. Try renewal and key lookup and record when each is denied. Measure the expiry of access already issued and the time until the returning device stops receiving new keys or updates. The deployment module configures a five-minute access token lifetime. Record the observed cutover for the actual deployment. Downloaded copies remain on the computer. Check that an authorized device can write after the cutover and that a replacement authorized device can read the new data. See the [Relay authorization model](../../references/architecture/0029-blind-relay.md).

With an eligible successor in the test team, try leaving while the original owner is the sole owner, then offer ownership. Verify a stale or cancelled offer is denied. Have the successor explicitly accept, confirm that the original owner loses management authority, then have the original owner leave. Check the same team and project still open with the same package and records. Verify that the former owner's private data and devices did not move.

If Onefin disables an Entra identity, use the agreed offboarding procedure to remove the member and revoke their grants in Prompt Studio. Verify the cutover using a previously enrolled device. Record whether the tenant policy also denies new sign-ins. See [device and Relay credential lifetimes](0007-account-manager.md).

## Triage

| Observation | First check |
| --- | --- |
| Microsoft sign-in is missing | Check that the client supports Microsoft and the deployed manager advertises the provider. Verify the account-manager credential pair and the exact Web callback. |
| Consent or MFA failed | Ask the tenant administrator to check Entra sign-in records and Conditional Access for the relevant test account and app. Retry in the browser with the intended account. |
| An invitation fails | Check expiry, cancellation, and signed-in identity. Ask the owner to issue a new invitation if the previous one expired or was cancelled. Avoid copying the link into support records. |
| Signed in but team sync is unavailable | Check the selected team and its Relay entitlement. If the team is available but a project is missing, verify the member’s explicit grant. |
| A project is waiting or its key is stale | Confirm the device can renew and request the current key generation. Compare the most recent grant or removal time with the configured token lifetime. Check whether an unaffected member can still sync. |
| A package fails to open | Compare the selected and installed digests, SDK/API compatibility, dependency lock, and transfer state. Use the last known good revision if the package cannot recover. |
| Data is out of date | Check the source device’s last successful scheduled run and the output record’s timestamp. On both employees’ devices, compare pending work, last acknowledged sync, and file progress. A successful transfer of an old snapshot points to stale source data. |

Check the [Relay monitoring guide](0022-relay-monitoring.md) for transport health and backlog. Inspect manager and Relay diagnostics for the qualification window and confirm they contain no test project content, source code, or credentials. Report a verdict for each scenario, with evidence for failures and gaps.
