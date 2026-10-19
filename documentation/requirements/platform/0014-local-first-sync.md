# PRD: Local-first sync with a blind relay

Status: Proposed. Created: 2026-10-19. Owner: platform. This PRD replaces the
synchronization contracts PRD (0007) as the source of truth for Prompt Studio Cloud.
Ticket PS-716 tracks the work.

## Purpose

A person should be able to use Prompt Studio on several machines as if they were one,
share a project with a team, and get everything back after resetting a machine. The
data lives on the clients. The relay is a small service that moves encrypted data
between clients and keeps an encrypted copy of the latest state. It cannot read
project content.

This fits the [mission](../../../MISSION.md): extensions own their data and edits, and
the platform owns storage, sync and recovery. Extensions use the normal storage, file
and editor APIs. They never handle encryption, merging or relay traffic.

## Why the earlier design is replaced

The design in PRD 0007 came from an earlier plan where one hosted server owned project
data. The relay kept that role. It applies each group of changes to a temporary copy,
checks preconditions, keeps conflicting versions, decodes Yjs updates, and was planned
to build snapshots and run retention. All of that needs to read project data, and it
makes the relay large.

This PRD moves merging to the clients. Clients merge every change automatically and in
any order. The relay never decides which change wins, so it does not need to read
anything.

## Terms

| Term | Meaning |
| --- | --- |
| Client | One Prompt Studio runtime with its own local database. The code calls its ID the environment ID. |
| Device | A client that a user has logged into the cloud from. The client's environment ID becomes its device ID. Each device belongs to one user. |
| Cloud project | A project (workbench) that syncs through the relay. Local projects never leave the device. |
| CRDT | A data type that merges edits made at the same time on different machines automatically, without a server. [Yjs](https://docs.yjs.dev/) is the CRDT library this PRD assumes. |
| Document | One CRDT unit that syncs on its own, for example one extension's records in a project, or one session transcript. |
| Update | An encrypted change to one document, produced by a client. |
| Latest state | An encrypted copy of one document's full current state, uploaded by a client. |
| Blob | An encrypted file stored by the relay, such as an image or an extension package. |
| Personal space | The documents that belong to one user inside one cloud project, such as their sessions. Only that user's devices get them. |

## Requirements

### Data lives on the clients

- R1. Every device keeps a full local copy of every cloud project it can access and of
  its user's personal spaces, including file contents. It works fully offline.
- R2. Clients merge changes with the CRDT. Text merges character by character. List
  items merge. Each top-level field of a record merges on its own. When two edits to the
  same field happen without either seeing the other, a fixed rule picks one. The rule
  does not use clocks, so it gives the same result on every device. If an edit was made
  after seeing another, the later edit wins. The relay never picks a winner.
- R3. The relay is never the source of truth. If the relay loses its data, any device
  with a full copy can upload it again.
- R4. A change that writes several records or files together is delivered and applied
  as one unit on every client. A client never shows half of it.
- R5. Merging does not keep rules that span records. Two offline edits can move the same
  item twice or create two items with the same name or number. Extensions that need
  unique or sequential values must handle duplicates. See
  [open questions](#open-questions).
- R6. A save is durable on the local device before the product reports it as saved.
- R7. The product shows the sync state of a cloud project: saved locally, waiting to
  sync, synced, offline, or a problem that needs attention.

### The relay cannot read project data

- R8. Clients encrypt every update, latest state, blob, live message and remote command
  before it leaves the device.
- R9. The relay sees only what it needs to route and store data: project ID, document
  ID, personal space owner, sending device, sizes, times, update IDs, sequence numbers
  and blob IDs. Document and blob IDs are random and do not reveal names or content.
- R10. The relay does not merge, read content, resolve conflicts, run extension code or
  index anything.
- R11. Logs and error reports from the relay and the account manager contain no project
  content.

### Keys

- R12. Encryption keys come from the account manager after Google login. The relay
  never holds keys. The account manager and the relay are separate services with
  separate storage. Known limit: someone who controls both services can read data. A
  stronger key design, for example with passkeys, may replace this later.
- R13. Each cloud project has a project key that all members' devices get. Each personal
  space has its own key that only that user's devices get.
- R14. The account manager backs up keys separately from relay data. Losing the key
  store must not make relay data unreadable.
- R15. Removing a member or device creates a new key for future data. Remaining devices
  keep the older keys so they can still read older data.
- R16. A cloud device holds keys like any other device. If the operator runs cloud
  devices and the relay, that operator can read the data of users with cloud devices.

### What the relay stores

- R17. For each document, the relay keeps one latest state and the updates sent after
  it. Together these are the sync source for offline devices and the cloud backup.
- R18. When the updates after a latest state pass a size limit, an online device that
  has all of them uploads a new latest state. It names the latest state it was built on
  and the last update it includes. The relay accepts it only if it was built on the
  current latest state, so two devices cannot replace each other's work.
- R19. Each latest state carries an encrypted summary of which edits it contains. A
  client compares the summary with its own copy and sends any edits that are missing.
  An incomplete latest state cannot remove data that a device still holds.
- R20. The relay keeps the previous latest state and the blobs it uses for a grace
  period after a new one arrives. This protects against a broken upload. It is not
  version history.
- R21. A client uploads a blob completely before it sends an update that refers to it.
  The relay deletes a blob only when no latest state or later update has used it for the
  whole grace period. The client sends the blob IDs each update and latest state use.
- R22. A device that was offline for any length of time downloads the latest state and
  the updates after it, then merges its own offline edits. Nothing waits for a device
  that stays offline.
- R23. Relay storage for a document stays below twice the size of its latest state,
  plus the grace-period copy.
- R24. The relay keeps no version history. Version history is a Prompt Studio feature
  on the client, or an extension such as Artifacts keeps its own versions. Client
  version history is also how a user recovers from a valid edit that deleted too much.
- R25. Large files upload and download separately from small updates, so a large file
  does not delay other changes. Interrupted file transfers resume.

### What the relay enforces

- R26. Only devices of a project's members can read or write its documents and blobs.
  Only a user's own devices can read or write that user's personal spaces.
- R27. The relay ignores an update it has already stored, using the update ID.
- R28. The relay limits update size, blob size, storage per account and request rate.
- R29. A client and the relay agree on a protocol version when they connect. A client
  on an older version gets a clear update message and keeps its local work.
- R30. An update that a client cannot decrypt or apply is reported and set aside. It
  does not stop other updates from syncing.

### Live traffic

- R31. Cursors, presence and live session output pass through the relay and are never
  stored.
- R32. Remote commands go only to an online device. A command to an offline device
  fails immediately. Nothing is queued.
- R33. A device accepts a remote command only if it is signed by another device of the
  same user. The signature uses a device key that only that device holds. Team members
  and the relay cannot send commands to someone else's devices.

### Devices and access

- R34. Logging in on a client makes it a device, connects it to every cloud project the
  user is a member of, and shows it on the user's other devices. There is no step to
  connect each project.
- R35. A user can make a local project a cloud project, and stop syncing it.
- R36. A team account owns cloud projects. Members see only the projects they are added
  to.
- R37. Removing a device or a member stops their future access. Data already on their
  machines stays there.

### Sessions and remote work

- R38. Each device writes its workspaces, sessions and transcripts to the user's
  personal space in that project. Each session transcript is its own document, so one
  long session does not make other documents large. Every device of that user can read
  them, even when the device that ran them is offline.
- R39. From any of their devices, a user can create a workspace, start a session, send a
  message, answer a question or approval, and interrupt a turn on another online device.
  There is no opt-in step on the target device.
- R40. A session runs on one device for its whole life. It does not move.
- R41. Shared records that point at a workspace or session include its device. Other
  members see the owner and device name, but cannot open it.
- R42. A user can start a device in the cloud. It behaves like any other device. Cloud
  devices replace the Remote Workspaces extension and its PocketCoder setup.

### Extensions and automations

- R43. The extensions a cloud project uses, with their versions, sync with the project,
  so every device runs the same code for it. Local development changes to extension
  code stay local.
- R44. Extension data migrations give the same result when two devices run them. A
  device with an older version of an extension can read that extension's data but
  cannot change it until it updates.
- R45. Each automation is assigned to one device and runs only there. It never moves to
  another device.

### Recovery

- R46. After resetting or replacing a device, a user logs in with Google and gets every
  cloud project and personal space back.

### Running the relay

- R47. The relay is one small service plus object storage. The total hosting target is
  under US$50 per month for the reference workload.
- R48. It is portable and can be self-hosted.

## Phases

| Phase | Includes | Requirements |
| --- | --- | --- |
| 1. One user, many devices | Encrypted CRDT sync of project data and files, latest state backup, Google login connects everything, device list, sync state, extension and automation sync, reset recovery | R1 to R31, R34, R35, R37 (devices), R43 to R48 |
| 2. Sessions follow you | Personal spaces, session and transcript sync, remote commands, cloud devices | R32, R33, R38 to R42 |
| 3. Teams | Team accounts, members, per-project membership, member removal | R36, R37 (members) |

Phase 1 replaces the v0.1 release defined in PS-736. It starts from the current code
on `main`, not from scratch. See [Impact on current code](#impact-on-current-code).
Phase 1 builds the project and personal key split (R13) from the start, so phases 2 and
3 do not change the storage format.

## Non-goals

- Conflict screens or keeping both versions of a conflicting edit. Clients merge.
- Version history on the relay.
- Queued commands for offline devices.
- Moving a running session to another device.
- Syncing working trees, terminals, processes, credentials or caches.
- Protecting data from someone who controls both the account manager and the relay.
- Old-client compatibility, history migration or backfill. Alpha relay data has no
  users.

## Impact on current code

| Area | Today on `main` | Decision |
| --- | --- | --- |
| Account manager (`infra/account-manager`) | Better Auth, Google login, accounts, grants and finite access tokens | Keep. Add devices, team members, key storage and key backup. Replace per-project enrollment with one login per device. |
| Relay storage (`infra/relay/src/storage`) | PostgreSQL groups, candidate evaluation, receipts, conflict alternatives, restore | Replace with encrypted updates and latest states per document. |
| Relay blobs (`infra/relay/src/assets`) | S3 asset storage with integrity checks | Keep and simplify. Content is encrypted and IDs are random. |
| Relay transport | Authenticated HTTP and WebSocket subscriptions | Keep and simplify for encrypted updates and live messages. |
| Protocol (`packages/pstdio-sync-contracts`) | Versioned groups, parents, receipts, covered checkpoints (PS-808) | Replace with a small protocol for encrypted updates, latest states, blobs and live messages. |
| Client sync (`packages/pstdio-sync`) | Journal of grouped changes, recovery proofs, snapshot fetch | Replace with a CRDT document store plus encryption and relay transport. |
| Local storage (`packages/pstdio-db/src/services/extension-storage/`) | Grouped record journal, accepted state, conflict branches and data migrations | Replace the journal and conflict branches with CRDT documents. Keep data migrations and make them repeatable (R44). |
| Public storage API (`storage.records`, `storage.assets`) | Released in 0.44 | Breaking change, see below. |
| Local identity | One environment ID per runtime | Keep. The environment ID becomes the device ID on login. |
| Redacted failure reporting (PS-785) | Merged | Keep (R11). |
| Native editor collaboration (PS-776) | A Yjs markdown editor with shared cursors in `packages/ui` (`collaborative-markdown-editor`). Native file editors are not wired to it yet. | Keep the component. Connect native editors to the new CRDT documents and live presence (R31). Drop the checkpoint and receipt dependencies. |

### Storage API change

`storage.records` and `storage.assets` shipped in 0.44 with behavior this PRD removes.
Under [API versioning](../../references/extensions/0014-api-versioning.md), changing
documented runtime behavior is a breaking change. Plan it as one breaking step:

| Member | Change |
| --- | --- |
| `records.read`, `records.list`, `records.id` | Keep. `read` loses its `branch` argument. |
| `records.commit` | Keep as the write call. `expectedRevision` is no longer required; edits merge (R2). |
| `StorageSaveOutcome` | Report the R7 states. Remove `conflict` and the relay checkpoint. |
| `records.outcome` | Keep only if a save can still be checked by operation ID; otherwise deprecate. |
| `records.conflicts`, `records.inspect`, `records.resolve` | Deprecate, then remove. There are no conflicts to inspect. |
| `storage.assets` retained versions and unresolved alternatives | Remove from the documented behavior. |

Add the new shapes next to the old ones, mark the old ones `@deprecated` with their
replacement, and remove them together in the next breaking release.

### Documents that change

- PRD 0007 is deleted. This PRD replaces it.
- PRD 0009 keeps owning the storage API shape. Its sync behavior follows this PRD.
- PRD 0010's rules for sync failures and relay retention are replaced by R19 to R23 and
  R30. Its local disk limits still apply.
- The [synchronization reference](../../references/architecture/0026-synchronization-contracts.md)
  and the [covered checkpoints reference](../../references/architecture/0027-covered-checkpoints.md)
  describe the current code until it is replaced.

## Acceptance

Phase 1 is done when:

- One user works on one cloud project from three devices, offline and online. Every
  device ends with the same content for Notes, Artifacts, Planner and an unrelated
  extension. No extension source contains sync, merge or encryption code.
- Two devices edit the same note offline and both edits survive the merge.
- A multi-record change appears completely or not at all on every device.
- A device that missed several latest-state replacements catches up and keeps its own
  offline edits.
- A device that is offline when a new latest state is uploaded later restores any of
  its edits the latest state is missing.
- A test dump of the relay database and object storage, searched for known titles, file
  names, record text and file bytes from the test project, finds none of them.
- A reset device recovers every cloud project after Google login.
- After 10,000 edits to one project, relay storage for each document is below twice its
  latest state size plus the grace-period copy.
- A blob referenced by an offline edit is still available when that edit syncs within
  the grace period.
- The reference workload stays under the hosting target. The workload is defined when
  phase 1 is planned.

Phases 2 and 3 get their own acceptance in their tickets.

## Open questions

- How do extensions with sequential IDs, such as Planner ticket numbers, avoid
  duplicates after offline edits?
- When one device deletes a record while another edits it, which wins? Proposed: the
  record stays deleted.
- How long is the grace period for previous latest states and unused blobs?
- Does data written by a local development version of an extension sync?
- Where does a cloud project live on disk on a new device, and how does the repository
  get cloned before a remote command creates a workspace there?
- Where do cloud devices run, and who pays for them?
