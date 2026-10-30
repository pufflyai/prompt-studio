# PRD: Restore project files without a Git host

Status: Proposed, awaiting a scope decision. Created: 2026-10-30. Owner: platform.
Ticket: PS-960, under PS-716. This is a design for review, not an accepted change to
[PRD 0014](0014-local-first-sync.md). No runtime behavior changes with this document.

## Outcome and boundary

A person opens a cloud project on a new device, chooses a new folder, and gets the
files that reached Cloud, including saved edits and new files. Git and a Git hosting
account are optional. The product explains what it retains and what is still local.

This fits the [mission](../../../MISSION.md): storage, encryption and recovery belong
in core because every tool needs them. The Cloud extension owns coverage and progress
UI through public APIs. Extensions keep owning their records and declared files.

This proposal adds automatic capture and explicit restoration of project folders.
It does not continuously apply downloaded source edits to an existing working folder.
An editor buffer must be saved to disk to enter a capture. Terminals, running agents
and processes cannot be restored. A restored session remains history on its original
device; it does not resume execution on the new one.

## Current behavior and cause

The missing piece is a general owner for folder recovery, not a missing Git provider.
The current folder flow can clone a recorded remote or attach an existing folder.
A clone cannot recover untracked files, saved edits or commits absent from the remote.

Source checked at `0c7e0548297e30bb10c133b7223d8a78dc4a7e71`:

- [Folder endpoint](../../../packages/pstdio-api/src/features/projects/endpoints/folder.ts)
  and [contract](../../../packages/pstdio-api-contracts/src/project-folder.ts) expose
  `path` and `clone`; neither restores a stored project tree.
- [Project info](../../../packages/pstdio-api/src/services/relay/project-info-owner.ts)
  records the name and Git remote, not folder contents.
- [Extension relay](../../../packages/pstdio-api/src/services/relay/extension-owner.ts)
  captures declared artifact mounts through the
  [shared file owner](../../../packages/pstdio-api/src/services/shared-files/artifact-mount.ts).
  It is not a scan of every project file.
- [Private history](../../../packages/pstdio-api/src/services/personal-history/capture.ts)
  captures workspace and session records and transcripts, not workspace trees.
- [Blob transport](../../../packages/pstdio-sync/src/relay/document-blobs.ts) encrypts
  assets, but currently buffers whole files. General folder recovery needs bounded
  memory for large files before it can use the R25 transfer contract.

PS-960 has no linked prerequisite tickets. Its assigned base contains these modules;
`update-stack` confirmed that base without adding dependency commits.

## Proposed coverage

“Retained” means available from a completed upload, within the coverage below.
It never means every byte on the source machine. Show exclusions before enabling
folder capture, and keep them inspectable afterward. Existing record sync continues.

| Data | Proposed treatment and owner |
| --- | --- |
| Project and extension records, resource identities, published extension versions, declared shared artifacts | Keep the current owners and project-key encryption. Do not copy their storage files into a second backup. |
| Ordinary files and directories in the default project folder | Capture saved bytes, relative paths, empty directories and executable bits, including untracked files and dotfiles except the exclusions below. Use the project key; project members can read them. |
| Local workspaces belonging to this project, including worktrees outside the project folder | Capture each root separately using the user's private-project-data key. Enumerate roots from existing workspace records, not by searching the disk. Do not share private work with project members. |
| Remote or unavailable workspace roots | Report as unavailable until their owning device/provider can capture them. Do not claim a workspace record proves its files are retained. |
| Git repositories and submodules inside an included root | Offer separate opt-in portable Git recovery using the source user's private key, including for a shared project folder. Review historical and staged content separately; current file exclusions cannot filter Git objects. No Git host is needed. |
| `.pstdio/extension-storage/` files outside declared shared mounts | Capture as private files, except extension-declared caches and the recovery service's own scratch data. Include drafts, report evidence and ticket checkouts. Keep publisher boundaries. |
| Declared shared mounts inside private or excluded storage paths | Keep the existing shared owner. The coverage map identifies that owner; the folder scanner neither republishes nor materializes those paths. |
| Dependencies and caches | Exclude `node_modules/`, runtime caches, and extension-declared caches by default. Do not exclude generic names such as `build/` or `dist/` without a coverage rule: they may hold user work. |
| Secrets and machine setup | Exclude `.env` and `.env.*`, private-key files (`*.key`, `*.pem`, `*.p12`, `*.pfx`), credential stores, sockets, device files, and runtime credentials. List the matching paths and reasons locally. A filename filter cannot detect every secret inside ordinary source files. |
| Prompt Studio installation and device bindings | Do not copy the runtime database, installed caches, absolute folder bindings or `.pstdio/config.json`. Recover records through their current owners and regenerate device bindings. |
| Local extension overrides under `.pstdio/extensions/` | Excluded and shown explicitly, following R43. Ordinary extension source elsewhere in the project remains an ordinary file. Installing or executing extensions is a separate explicit workflow. |
| Files outside declared roots | Excluded. Do not follow symlinks into the rest of the machine. |

Coverage rules are encrypted project data, with private workspace additions kept private.
Do not treat `.gitignore` as a recovery policy: it commonly excludes work people still
need. Show its ignored paths during coverage inspection without excluding them solely
for that reason. Users can exclude additional files or opt in excluded dependency or
secret-pattern files after inspecting the affected paths and their audience. Runtime
credentials, special files and installation/device state remain excluded.

Resolve path ownership before reading file bytes. A private subtree inside a shared
root must not enter a project-key manifest, even through an alias or nested workspace.
The most restrictive owner wins for overlaps; hard-linked files are read as separate
entries only under their permitted roots. A parent scanner skips child workspace roots.
Local paths and detailed errors stay local or encrypted.

Record safe relative symlinks without following them. Reject links that escape the
root, absolute links, and paths that cannot be represented on the destination. Restore
never writes through a link. Report case collisions, reserved names, unsupported link
types and permissions before materialization; do not silently rename or drop entries.
Owner IDs, ACLs and platform-specific extended attributes are excluded in this first
outcome and appear in coverage. Hard links restore as independent files.

## Git policy

Do not upload a raw `.git` directory or a worktree's pointer to another device's path.
Offer Git recovery separately from ordinary file capture, with a private audience and
explicit consent for history and staged content. An object graph can contain deleted
secrets, ignored files and private subtrees absent from today's working folder.
Preserving commit IDs requires that graph; silently filtering its objects cannot
preserve the original commits. File exclusion rules do not sanitize Git history.

Before consent, inspect all reachable trees and index entries for excluded paths and
show the additional coverage locally. Other excluded content needs a separate opt-in
for private Git retention. Hard-excluded credentials or installation/device state
anywhere in the graph block its capture; do not upload the graph, rewrite history or
claim complete Git recovery. Filename review still cannot identify secrets embedded
in arbitrary source bytes. Ordinary file capture remains available with a clear
Git-not-retained reason when consent is absent or a graph is blocked.

For an admitted graph, capture reachable objects and refs, detached HEAD, and the
staged index entries and their objects. Keep this in a private companion manifest;
shared manifests contain neither its objects nor private branch/path metadata.
Rebuild an independent repository on restore, with the captured branch, index and
working files. This preserves unpushed commits, staged-only content, saved unstaged
edits and new files within the admitted coverage. A submodule is captured as its own
repository and files; its parent does not supply missing objects. Missing objects or
unavailable submodules make Git recovery incomplete, not successfully backed up.

Exclude hooks, credential-bearing remotes, machine Git configuration, locks, reflogs
and unreachable objects. Retain no authentication material. Recovery does not require
or contact a remote. A user can set a remote again afterward. Report these exclusions
and do not promise recovery of deleted branches or reflog-only commits. If Git is not
available, ordinary files still capture, with Git recovery explicitly incomplete.

## Capture and encrypted storage

Use one core recovery owner for each existing project/default-workspace or private
workspace identity on its source device. Keep source devices separate: a restored
device creates its own source entry, rather than overwriting another device's copy.
There is no global “newest device wins” tree and no wall-clock conflict rule.

Each owner publishes one current immutable manifest through an encrypted document.
The manifest lists coverage rules, capture interval, source identity, parent capture,
relative paths, types, lengths, content digests and chunk references. Portable Git state
belongs to the private companion manifest, even when working files are project-shared.
An encrypted catalog discovers the owners using the same project/private visibility
split as the data. Relay document and blob IDs are opaque and reveal no paths, hashes,
branch names or project names. Use the existing keys, authorization and latest-state
transport. The relay stores and routes ciphertext; it never scans or merges a tree.

Split large contents into independently encrypted bounded chunks and transfer them
through resumable blob storage. Reuse unchanged chunks within the same encryption
space; do not expose plaintext hashes or deduplicate across accounts on the server.
Persist the local manifest and ciphertext references durably before acknowledging a
capture. Keep this core data under the runtime's project storage, not in extension
source or new folders directly under the linked project's `.pstdio/` directory.

Watch filesystem changes to schedule scans, including writes from external editors
and tools. Reconcile with a full scan on startup, reconnect, watcher overflow and an
explicit “Back up now” action. Watch events are hints; correctness cannot depend on
receiving every event. Persist pending work across restarts. Do not publish a new
complete manifest until all included files and Git state have been read and every
referenced blob has been acknowledged by the relay (R21).

Detect files or Git refs changing during capture and rescan those entries. Report
unreadable, changing, oversized or quota-blocked entries. A scan failure is never
interpreted as a deletion. A successful scan represents deletions by absence from
the new complete manifest; a rename is a removed path and an added path that can reuse
content. Changing exclusions changes declared coverage, not a fabricated file delete.

Ordinary filesystem scans do not provide a single atomic instant across unrelated
external writes. Show the capture interval. Capture saves made through an atomic
Prompt Studio file operation at that operation's boundary; do not split that save
across visible manifests (R4). This is file recovery, not a disk image or an
application-consistent backup of arbitrary databases. Explain that open database files
need their application's export before capture.

Keep the previous completed cloud capture while a new one uploads. Interrupted
transfers resume against durable blob references; failure leaves the previous capture
restorable and marks newer work pending. R20/R21's grace period protects referenced
blobs during replacement. The relay retains only current state plus that grace copy,
not an archive of all captures. Client recovery history remains under R53; do not
promise that its current implementation already snapshots these new file owners.

## Several devices and restoration

Devices download completed manifests and their included bytes into the local recovery
store even before a project folder is chosen, preserving offline access under R1.
This does not project remote bytes into an active working folder. A project may have
several source copies with different unsent work; list each source device, workspace,
capture interval and coverage. Let the person select the source to restore. Never
collapse them into one arbitrary latest tree. A missing source device does not prevent
restoring its last completed capture.

Restore to a new, absent destination. An existing destination, even an empty folder,
is refused without writes. Offer a new sibling folder or the existing attach workflow;
attaching local work is not restoration and does not replace it. No overlay, implicit
three-way merge, file replacement, or cloud deletion is applied to existing work.
The same rule applies when a device already has an attached project folder: restoring
another source produces a separate workspace and keeps the current folder attached.

Before writing, validate the whole manifest, ownership, path boundaries and destination
capabilities, then verify all required blobs and Git objects. Restore into an exclusively
created staging directory beside the destination on the same filesystem. Persist an
operation journal, resume verified downloads after interruption, and recheck boundaries
at writes. Final publication must refuse replacement if another process creates the
destination. Use a platform-supported no-replace operation; a check followed by an
ordinary replacing rename is insufficient. An interrupted operation never attaches a
partial folder or reports it ready.

Bind the finished folder to the local project/workspace only after verification and
publication. Regenerate device configuration and expose restored files for inspection.
Recovery itself never executes restored hooks, scripts, provisioning or local extension
code. Launching project tools follows the normal trust and setup flow afterward.
Private workspace roots restore separately, with new local workspace identities and
source references; their old sessions retain their original owner/device identities.
Cancel removes only staging files owned by the operation, never pre-existing work.

## Coverage and progress contract

Extend the existing derived sync state rather than storing a second project status.
Cloud UI and CLI/API must expose the same coverage and recovery operations:

- Included roots, their audience, exclusions with reasons, and unavailable roots.
- Last completed capture per source, capture interval, included file/byte counts,
  and bytes/files pending or blocked since that capture.
- Distinct progress for existing records, retained files, local download and folder
  restoration. Record sync completion cannot imply file backup completion.
- Errors with the affected local path and action needed, such as freeing space,
  changing coverage or installing Git. Transport errors contain no readable paths.

An initial upload with missing entries is incomplete. A previous complete capture may
remain available while current coverage has pending work; label both facts. Never
call a partial set “all project data.” No folder is needed to use downloaded records.
Offline restoration works only when every included blob for the selected capture is
local; otherwise show what still needs downloading.

Core owns scanning, manifests, transfer, authorization and restore operations. Public
SDK/API methods let the Cloud extension and agents inspect coverage, request capture,
list sources, download, restore, cancel and observe progress. CLI commands call those
same methods. Exact method names and additive/deprecation steps need an API review
before implementation; do not silently change the released `clone` input contract.

## Reconcile PRD 0014 before implementation

Approval must explicitly accept the following changes together. Until then PRD 0014
continues to exclude working trees, and PS-825's existing flow remains authoritative.

| PRD 0014 contract | Proposed amendment |
| --- | --- |
| R1, R7, R46 | Full recovery includes the declared folder coverage and completed per-source captures, with independent pending/upload/download/restore progress. “Full” never hides exclusions. |
| R2 and the working-tree non-goal | Keep CRDT merging for existing shared data. Add captured working trees for explicit restoration; do not CRDT-merge or continuously project their source file bytes. |
| R4 | Publish complete manifests, preserve platform atomic file-save boundaries, and state the limits of scanning external writes. |
| R8, R9, R13, R26 | Reuse client encryption and project/private authorization; keep private workspace paths and bytes out of shared captures. |
| R17–R25, R28 | Keep opaque latest-state/blob storage and grace retention. Implement bounded, resumable file transfer; report quota failures without silently narrowing coverage. |
| R34 and the 2026-10-21 new-device decision | Add restore-from-Cloud as the general folder path. Clone and attach remain explicit alternatives; a remote is never required for recovery. |
| R38, R40, R43 | Add private workspace and opt-in Git-history recovery without moving sessions or automatically installing/activating local overrides. Historical code coverage requires separate consent. |
| R53, R55 | Define file-owner participation in local recovery history during implementation; keep Cloud UI in its extension on the public API. |

The 5 GiB reference workload, 1 GiB file and hosting target still apply. Measure
transfer memory, interrupted-transfer overhead and encrypted storage on that workload;
do not increase budgets or shrink the workload to fit this design.

## Validation and delivery sequence

First accept or amend this design and PRD 0014's boundary. Then plan implementation
work with real dependencies: core coverage/manifests and portable Git capture;
bounded encrypted transfer and derived progress; safe restore and public APIs;
Cloud UI and new-device folder flow. Use Canvas policy for that UI work. Canvas is
skipped for this document-only design because it changes no visual implementation.
Update user guides and storage references only when their behavior ships.

Before the implementation is delivered, prove these supported outcomes:

1. Two isolated runtimes recover a non-Git project with text, binary, empty-directory
   and executable entries, without any Git host or source device online.
2. Saved edits and new files restore. An explicitly admitted private Git graph restores
   staged-only content, unpushed and detached commits. Historical excluded paths and
   staged secrets cannot bypass coverage or leak into shared data. Include refs shared
   by linked worktrees in that review. Blocked graphs, withheld consent, missing
   submodules and unavailable Git are reported.
3. External writes, missed watcher events, restarts, deletes, renames and unreadable
   files produce the defined manifests and pending state. Multi-file platform saves
   never become visible halfway through.
4. Interrupted chunk transfers and capture replacement preserve the previous complete
   copy. Quota, disk and integrity failures never mark incomplete data complete.
5. Concurrent offline work on two devices remains independently restorable; neither
   source overwrites the other. Reset/new devices recover both authorized sources.
6. Existing destinations and concurrent destination creation preserve local work.
   Traversal, symlink escapes, case collisions and interrupted publication cannot
   write outside staging, replace user work or attach a partial folder.
7. Private workspace bytes, extension drafts and nested private roots stay private.
   Declared shared files retain one owner. Relay dumps reveal no known names or bytes.
8. CLI/API and one critical Playwright folder/download scenario expose the same choices,
   errors and progress, including offline and incomplete recovery. The 1 GiB transfer
   does not block small record updates or another account.

## Decision needed

Accept or amend the coverage table, private workspace capture, portable Git policy,
per-source manifests, and restore-only-to-new-folder rule, and authorize the listed
PRD 0014 amendments. This ticket and its research explicitly require that decision
before runtime implementation. This proposed PRD alone does not make it.
