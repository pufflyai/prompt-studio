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
and editor APIs. They never handle encryption, merging or relay traffic, and they never
write merge rules: data merges by its shape, and core provides record IDs, resource
numbers and hand-arranged order.

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
| Document | One CRDT unit, for example one extension record or one session transcript. The records of one extension in a project travel together through one encrypted relay document, the record stream ([ADR 0102](../../adrs/0102-record-stream-sync.md)). |
| Update | An encrypted change to one document, produced by a client. |
| Latest state | An encrypted copy of one document's full current state, uploaded by a client. |
| Blob | An encrypted file stored by the relay, such as an image or an extension package. |
| Private project data | The documents that belong to one user inside one cloud project: their workspaces, sessions and transcripts. Only that user's devices get them. The code calls this the personal space. |

## Requirements

### Data lives on the clients

- R1. Every device keeps a full local copy of every cloud project it can access and of
  its user's private project data, including file contents. It works fully offline.
- R2. Clients merge changes with the CRDT, following the shape of the data. Extensions
  do not declare merge rules, and a save does not need to say what changed: the client
  compares the saved value with the current one.
  - Objects merge key by key, at every depth.
  - Lists merge item by item. Items that a device adds or removes stay added or
    removed. A list of distinct values never gains a duplicate, and a moved item ends in
    one place. List items that are objects with an `id` are matched by that ID, and
    their fields merge like any object.
  - A string merges character by character once it contains a line break. Files merge
    the same way.
  - Any other value, such as a number, a boolean or a single-line string, is replaced
    as a whole.

  When two edits to the same value happen without either seeing the other, a fixed rule
  picks one. The rule does not use clocks, so it gives the same result on every device.
  If an edit was made after seeing another, the later edit wins. The relay never picks a
  winner. The only shape rule for authors: a setting that holds one value, such as a
  single-select tag, is its own field, not an item in a list.
- R3. The relay is never the source of truth. If the relay loses its data, any device
  with a full copy can upload it again.
- R4. A change that writes several records or files together is delivered and applied
  as one unit on every client. A client never shows half of it. One save of an extension's
  records is one update in its record stream.
- R5. Merging cannot keep rules that span records, such as "only one ticket is in
  progress". Two offline edits can break such a rule, and the extension shows or repairs
  the result. Unique resource numbers, record IDs and hand-arranged order do not fall
  under this rule: core provides them (R49 to R51).
- R6. A save is durable on the local device before the product reports it as saved.
- R7. The product shows the sync state of a cloud project: saved locally, waiting to
  sync, synced, offline, or a problem that needs attention. Offline means the device has
  lost its connection. A project that does not sync is called Local, not Offline.

### Core provides what merging cannot

- R49. Core owns the number of every resource whose kind declares a prefix, such as
  PS-12 or RP-4. `resources.allocate` hands out numbers on each device. When two devices
  hand out the same number offline, core keeps it on the resource whose ID sorts first
  and gives the other the next free number. The rule uses IDs, not clocks. The old
  number stays an alias, so links, branch names and agent references still open the
  resource; an alias shared by two resources shows both. Extensions read the current
  number from core and do not keep their own copy.
- R50. Extensions create record IDs with a core function. Outside a data migration it
  returns a new random ID. Inside a data migration it derives the ID from the migration
  version and a key the extension passes, such as the ID of the source record, so two
  devices that run the same migration create the same records.
- R51. Core provides order positions for lists that people arrange by hand. A position
  can be created between any two others, is unique to the device that created it, and
  never needs rebalancing. Two devices that move items at the same time end with the
  same order, with every item once.
- R52. The SDK lets extension authors test their data on two simulated devices that edit
  offline and then merge. It reports which concurrent edits replaced each other.

### The relay cannot read project data

- R8. Clients encrypt every update, latest state, blob, live message and remote command
  before it leaves the device.
- R9. The relay sees only what it needs to route and store data: project ID, document
  ID, owner of private project data, sending device, sizes, times, update IDs, sequence numbers
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
- R13. Each cloud project has a project key that all members' devices get. Each user's private
  project data has its own key that only that user's devices get.
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
  on the client (R53), or an extension such as Artifacts keeps its own versions. Client
  version history is also how a user recovers from a valid edit that deleted too much.
- R25. Large files upload and download separately from small updates, so a large file
  does not delay other changes. Interrupted file transfers resume.

### What the relay enforces

- R26. Only devices of a project's members can read or write its documents and blobs.
  Only a user's own devices can read or write that user's private project data.
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
  connect each project. Cloud projects show in the project picker right after login,
  before the device has a folder for them.
- R35. A user can make a local project a cloud project, and make a cloud project local
  again. Making a project local applies to the whole account, not to one device. It is
  done in Cloud settings, after a warning and a confirmation. Every device keeps its
  copy. If the project syncs again later, the copies merge by R2.
- R36. A team account owns cloud projects. Members see only the projects they are added
  to.
- R37. Removing a device or a member stops their future access. Data already on their
  machines stays there.
- R54. During early access, the account manager turns Cloud on per account. An operator
  turns it on by the account's email. Only those accounts get cloud projects, keys and
  relay access. Every other user can still log in and sees Cloud sync as coming soon.
  The relay only checks the account manager's access tokens. Plans and billing come
  later.

### Who owns the Cloud UI

- R55. A bundled Prompt Studio Cloud extension owns the Cloud UI: the status bar item,
  its popover and Cloud settings. Core keeps credentials, login, the relay connection,
  sync, presence and the R7 sync state, and gives extensions the account, devices and
  sync state through the public SDK. The dashboard has no Cloud UI of its own.
- R56. Bundled extensions can add surfaces that appear in every project, and keep
  settings that stay on one device and never sync.

### Sessions and remote work

- R38. Each device writes its workspaces, sessions and transcripts as the user's
  private project data in that project. Each session transcript is its own document, so one
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
  so every device runs the same code for it. A local override, such as a repo-local copy
  someone is editing, never syncs its code. Data it writes syncs like any project data,
  but its data migrations do not run: migrations run only from the synced version.
- R44. Extension data migrations give the same result when two devices run them. Records
  a migration creates get their IDs from R50, so both devices create the same records
  instead of duplicates. A device with an older version of an extension can read that
  extension's data but cannot change it until it updates.
- R45. Each automation is assigned to one device and runs only there. It never moves to
  another device.

### Recovery

- R46. After resetting or replacing a device, or installing Prompt Studio on a new one, a
  user logs in with Google and gets every cloud project back. Their private project data
  comes back too once it syncs in phase 2.
- R53. Each device keeps at most three recovery snapshots of every cloud project:
  one captured hourly, one every 12 hours, and one daily. Show their actual capture
  times. Use the disk capacity the device supports, with no fixed snapshot byte
  quota or free-space reserve. If space cannot hold three snapshots, keep only the
  12-hour snapshot. A project, or one extension's data in it, can be restored to a
  snapshot through the CLI and API. The app has no restore screen (decided
  2026-10-24). A restore is a normal edit, so it syncs to every device. This policy
  was decided on 2026-10-22 and replaces daily snapshots retained for 30 days.

### Running the relay

- R47. The relay is one small service, a small PostgreSQL database for document metadata
  and ordering, and object storage for encrypted payloads. The total hosting target is
  under US$50 per month for the reference workload.
- R48. It is portable and can be self-hosted.

## Phases

| Phase | Includes | Requirements |
| --- | --- | --- |
| 1. One user, many devices | Encrypted CRDT sync of project data and files, latest state backup, Google login connects everything, early access, device list, sync state, Cloud UI as an extension, extension and automation sync, reset recovery | R1 to R31, R34, R35, R37 (devices), R43 to R56 |
| 2. Sessions follow you | Private project data (workspace, session and transcript sync), remote commands, cloud devices | R32, R33, R38 to R42 |
| 3. Teams | Team accounts, members, per-project membership, member removal | R36, R37 (members) |

Phase 1 replaces the v0.1 release defined in PS-736. It starts from the current code
on `main`, not from scratch. See [Impact on current code](#impact-on-current-code).
Phase 1 builds the split between project keys and private-data keys (R13) from the start, so phases 2 and
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
| Account manager (`services/account-manager`) | Better Auth, Google login, accounts, grants and finite access tokens | Keep. Add devices, team members, key storage, key backup and the per-account early-access switch (R54). Replace per-project enrollment with one login per device. |
| Cloud UI | None on `main`. Draft PR #1291 built it in the dashboard. | Build it in the bundled Prompt Studio Cloud extension on the public SDK (R55). Core exposes the account, devices and sync state. |
| Relay storage (`services/relay/src/storage`) | PostgreSQL groups, candidate evaluation, receipts, conflict alternatives, restore | Replace with encrypted updates and latest states per document. |
| Relay blobs (`services/relay/src/assets`) | S3 asset storage with integrity checks | Keep and simplify. Content is encrypted and IDs are random. |
| Relay transport | Authenticated HTTP and WebSocket subscriptions | Keep and simplify for encrypted updates and live messages. |
| Protocol (`packages/pstdio-sync-contracts`) | Versioned groups, parents, receipts, covered checkpoints (PS-808) | Replace with a small protocol for encrypted updates, latest states, blobs and live messages. |
| Client sync (`packages/pstdio-sync`) | Journal of grouped changes, recovery proofs, snapshot fetch | Replace with a CRDT document store plus encryption and relay transport. |
| Local storage (`packages/pstdio-db/src/services/extension-storage/`) | Grouped record journal, accepted state, conflict branches and data migrations | Replace the journal and conflict branches with CRDT documents that merge by shape (R2). Keep data migrations and make them repeatable (R44). |
| Resource numbers (`resources.allocate`, `extension_resource_sequences`) | A local counter per project and resource kind. Planner and Reports store their own copy of each number. | Keep the API. Repair duplicate numbers after merges, keep old numbers as aliases, and make core the only owner of the current number (R49). |
| Record IDs | Planner, Reports, Notes and Artifacts call `crypto.randomUUID()` themselves | Add a core ID function that is deterministic inside data migrations (R50). |
| Hand-arranged order | Planner stores numeric positions and rebalances them when gaps run out | Add core order positions (R51). |
| Public storage API (`storage.records`, `storage.assets`) | Released in 0.44 | Breaking change, see below. |
| Local identity | One environment ID per runtime | Keep. The environment ID becomes the device ID on login. |
| Redacted failure reporting (PS-785) | Merged | Keep (R11). |
| Native editor collaboration (PS-776) | An unused Yjs editor component in `packages/ui` (`collaborative-markdown-editor`) with no Markdown support and a `y-websocket` provider. Native file editors are not shared. | Delete the unused component. Bind native Markdown editors to one shared text document per file, with live cursors and presence (R31). Drop the checkpoint and receipt dependencies. |

### Storage API change

`storage.records` and `storage.assets` shipped in 0.44 with behavior this PRD removes.
Under [API versioning](../../references/extensions/0014-api-versioning.md), changing
documented runtime behavior is a breaking change. Plan it as one breaking step:

| Member | Change |
| --- | --- |
| `records.read`, `records.list`, `records.id` | Keep. `read` loses its `branch` argument. |
| `records.commit` | Keep as the write call. `expectedRevision` is no longer required; edits merge (R2). |
| `StorageSaveOutcome` | Report the R7 states. Remove `conflict` and the relay checkpoint. |
| `records.outcome` | Keep. It returns the R7 save states, so a caller can wait until a save has synced. |
| `records.conflicts`, `records.inspect`, `records.resolve` | Deprecate, then remove. There are no conflicts to inspect. |
| `storage.assets` retained versions and unresolved alternatives | Remove from the documented behavior. |

Add the new shapes next to the old ones, mark the old ones `@deprecated` with their
replacement, and remove them together in the next breaking release.

The core functions from R49 to R52 are additions that do not break existing extensions:
`storage.ids.create()`, `migration.id(key)` inside `storage.migrate`,
`storage.positions.between()`, `resources.identity()`, `resources.findByShorthand()`,
the `resourceEvents.renumbered` event, and the SDK's two-device test helper.

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
- Two devices edit the same note, and different fields, nested keys and list items of
  one record, offline. Every edit survives the merge.
- Two devices create resources of the same kind offline. After the merge every resource
  has a unique number, the same on both devices, and its old number still opens it.
- Two devices run the same data migration offline and end with the same records.
- Two devices move the same cards offline and end with the same order, each card once.
- A multi-record change appears completely or not at all on every device.
- A device that missed several latest-state replacements catches up and keeps its own
  offline edits.
- A device that is offline when a new latest state is uploaded later restores any of
  its edits the latest state is missing.
- A test dump of the relay database and object storage, searched for known titles, file
  names, record text and file bytes from the test project, finds none of them.
- A reset device recovers every cloud project after Google login.
- An account without early access can log in, gets no cloud projects and sees Cloud
  sync as coming soon. An account with early access gets the full Cloud UI.
- A project made local is edited on two devices and then synced again. Both devices end
  with the same merged content.
- The Cloud status bar item, popover and Cloud settings come from the Prompt Studio
  Cloud extension. The dashboard ships no Cloud UI.
- After 10,000 edits to one project, relay storage for each document is below twice its
  latest state size plus the grace-period copy.
- A blob referenced by an offline edit is still available when that edit syncs within
  the grace period.
- The reference workload stays under the hosting target: one user, two cloud projects,
  three devices, 10,000 records and 5 GiB of files including one 1 GiB file, with a
  second account syncing during the large transfer.

Phases 2 and 3 get their own acceptance in their tickets.

## Decisions made during ticket refinement

These defaults were chosen on 2026-10-19 so the phase tickets could be refined. The owner can change them.

- A record deleted on one device while another device edits it stays deleted.
- Core renumbers duplicate resource numbers after offline edits (R49). The resource whose ID sorts first keeps the number, and the other gets the next free number and keeps the old one as an alias. Planner and Reports only read the current number from core.
- The grace period for previous latest states and unused blobs is 7 days, set by the operator.
- A device uploads a new latest state when the updates after the current one exceed 1 MiB or 1,000 updates.
- A cloud project's data downloads without a local folder. The device asks for a folder, and offers to clone the project's git remote, the first time something needs files.
- Cloud devices run in the user's own cloud account from the released runtime image. Prompt Studio does not host or bill them in phase 2.

## Decisions made on 2026-10-21

These came from the Cloud and Workspaces design review. The designs are in PR #1298 (`design/prompt-studio-design-system.pen`).

- The Cloud UI moves out of core into a bundled Prompt Studio Cloud extension (R55, R56). PS-784 now covers only the SDK and host side; PS-875 builds the extension.
- Early access comes before plans and billing (R54, PS-871).
- Offline means the connection is lost. Local means the project does not sync (R7).
- The Cloud popover has no sync switch. Making a project local is account-wide and lives in Cloud settings (R35).
- The popover lists devices only while the project syncs and the device is online.
- A project records its git remote when it becomes a cloud project, so a new device can offer to clone it when it first needs files (R34, PS-825).
- A bundled Workspaces extension shows the user's workspaces grouped by the device they live on, using the private project data from R38 (PS-876).
- "Personal space" is now called "private project data" in the product, docs and tickets. A new machine gets its cloud projects back in phase 1 (PS-825); private project data comes back in phase 2 (PS-826).
