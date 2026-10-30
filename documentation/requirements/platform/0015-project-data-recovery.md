# PRD: Restore project files without a Git host

Status: Proposed implementation design. Created: 2026-10-30. Owner: platform.
Ticket: PS-960, under PS-716. The user chose project-folder coverage with a separate
`.pstignore` file on 2026-10-30. `.gitignore` does not control sync, so `.env` files
remain included unless explicitly excluded in `.pstignore`. This document and
[PRD 0014](0014-local-first-sync.md) reflect that decision. Runtime work is not yet
implemented by this documentation change.

## Outcome and boundary

A person opens a cloud project on a new device, chooses a new folder, and gets every
included project-folder file that reached Cloud. Saved edits, new files and local Git data
come back without a Git hosting service. No commit or push is required.

This fits the [mission](../../../MISSION.md): storage, encryption and recovery belong
in core because every tool needs them. The Cloud extension owns progress and recovery
UI through public APIs. Extensions keep owning their records and declared files.

Automatic upload and download keep a recoverable copy on the user's devices. This
first outcome does not continuously apply remote source edits to an active folder.
Editor buffers must be saved to disk. Terminal and process execution do not move to
another device; their saved files do. Existing session history keeps its device owner.

## Current behavior and cause

The missing piece is a general owner for folder recovery, not a missing Git provider.
The current folder flow can clone a recorded remote or attach an existing folder.
A clone cannot recover untracked files, saved edits or commits absent from the remote.

Source checked at `0c7e0548297e30bb10c133b7223d8a78dc4a7e71`:

- [Folder endpoint](../../../packages/pstdio-api/src/features/projects/endpoints/folder.ts)
  and [contract](../../../packages/pstdio-api-contracts/src/project-folder.ts): the
  folder response returns `path` and `gitRemote`; choose-folder input accepts `path`
  and `clone`. Neither operation restores a stored project tree.
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

## Folder coverage and `.pstignore`

The project folder is the inclusion boundary. Include everything except paths matched
by the root `.pstignore`. `.gitignore`, Git tracked/untracked state, global Git rules
and extension cache declarations do not filter the folder capture. The same rule works
without Git installed and for non-Git projects.

When a new folder is first enrolled without an inherited capture policy, create a
missing `.pstignore` with this starter rule. Do not overwrite an existing file or
recreate a deleted one:

```text
node_modules/
```

This skips dependency directories at any depth. Users can remove that rule or add
their own, such as `.cache/` or `dist/`. There are no other built-in path exclusions.
An empty or deliberately deleted `.pstignore` means all project-folder files are
included. `.env` and `.env.*` are not in the starter rules and remain included even
when `.gitignore` excludes them.

Restoring a capture inherits its applied policy, including an empty file or deliberate
absence. Starting capture on that new device must not seed a starter policy over the
restored choice. Record absence in the manifest, so round-trip recovery preserves it
without a separate local preference flag.

Use one UTF-8 `.pstignore` at the project root. Nested `.pstignore` files are ordinary
files, not additional policies. Use familiar ignore-file patterns: `#` comments,
`*`, `?` and `**` globs, `/` for root-relative patterns, a trailing `/` for directories,
and `!` for re-inclusion. A pattern without a slash matches a name at any depth.
The last matching rule wins. An excluded parent must be re-included before any child
can be re-included. Escaped leading `#` and `!` match literal names.

Always include the root `.pstignore` itself, including under broad patterns such as
`*`. Store its exact contents and applied rules with each encrypted manifest. Read
the policy as a regular file without following links. An unreadable, invalid or
changing policy blocks a new capture; never silently fall back to including files.
Re-scan when it changes, and verify it is unchanged before publishing the manifest.

| Data inside the project folder | Required treatment |
| --- | --- |
| Saved source, binaries, new files, dotfiles, empty directories and executable bits | Include unless matched by `.pstignore`. No commit or push is needed. |
| `.git`, nested repositories and submodule files | Include unless matched by `.pstignore`, including objects, index, refs, reflogs, config and hooks. No separate Git opt-in. |
| `.env`, key files and other credential-bearing files | Include unless explicitly matched by `.pstignore`, encrypted on the client before transfer. No secret-pattern exclusions. |
| `node_modules`, build output, caches and Git-ignored files | Apply `.pstignore` only. The starter file excludes `node_modules/`; build output and caches remain included until users add rules. Size or transfer failures are not exclusions. |
| `.pstdio/config.json`, `.pstdio/extensions` and `.pstdio/extension-storage` content | Include unless matched by `.pstignore`, including local extension code, caches, drafts, reports and nested workspace files. Preserve publisher paths. |
| Files already represented by extension records or declared mounts | Apply `.pstignore` to their on-disk capture. This does not change the separate shared-record or declared-file sync owner. The scanner is read-only. |
| Root `.pstignore` | Always retain the exact applied policy with the capture. |
| Included symlinks | Retain the link and its exact target text without following it. An external target does not become part of the project folder. |
| Unreadable, changing or unsupported included entries | Report the entry as pending or blocked. Do not skip it and mark the included copy complete. |

List excluded paths or directory roots with the matching rule, separately from errors
and pending entries. Do not read or upload excluded file contents. Excluding a directory
does not require traversing its contents. A complete capture means all included data
under the displayed policy, not a full copy of excluded paths.

Changing a rule changes coverage in the next manifest. Newly excluded paths leave the
current capture after it completes; they are not filesystem deletions and do not
delete local files. Re-included paths must finish uploading before the new capture is
complete. Previous captures and grace-period blobs can still contain previously
included bytes; changing `.pstignore` is not an immediate purge of stored history.

For included entries, preserve supported metadata, including permissions and link information. If the
source or destination cannot retain an entry or its required metadata, explain the
limitation and keep the operation incomplete. A socket or device entry is not a
running process that can be copied; detecting one must produce an explicit unsupported
entry rather than a successful partial backup.

Files outside the project folder are outside this requirement. Workspace records
still recover through private project data, but a workspace path outside the folder
does not imply its files are retained. Show that boundary. Do not search the whole
machine or follow links to copy unrelated folders. Referenced Git administration
needed to restore an included worktree is handled explicitly below.

## Ownership and encryption

A complete folder can contain private workspaces, credentials and historical private
files inside `.git`. Keep the entire per-source folder capture in the source user's
private project data, encrypted with that user's private-project-data key (R13).
Only that user's devices can read it. Membership in a shared project does not grant
access to another member's raw folder capture. Do not split a Git object graph by
current pathname or copy private subtrees into a shared manifest.

Existing shared records and declared shared files keep their current public APIs,
owners and project-key encryption. File recovery is a captured filesystem state,
not another live writer of extension records. Restore must not race the existing
file projection or run extension migrations on half-restored files.

Relay document and blob IDs are opaque. Filenames, paths, content hashes, Git refs,
configuration and file bytes stay encrypted. The relay stores and routes ciphertext;
it does not inspect folders. Logs and transport errors contain no readable paths or
content. This extends the current encryption and access rules, not the trust of
other project members.

Folder captures follow R15 and R37 for device removal: revoke future service access
and rotate keys for future data. A removed device can still decrypt older ciphertext
with keys it already received and keep its downloaded files. Removal cannot erase
those copies or retroactively revoke their encryption keys. Remaining devices keep
old keys for historical recovery; this feature adds no remote-wipe promise.

## Git and device-specific files

Capture `.git` under the same `.pstignore` policy. When included, retain its files,
including local-only objects, staged data, reflogs, hooks and configuration. Excluding
Git administration or required objects must disable the functional Git recovery claim;
do not claim a partial object graph is a complete repository. Do not substitute a clone,
rewrite history, filter historical secrets or require a second consent step. The
private audience above covers both current files and historical objects. `.pstignore`
filters filesystem paths, not content embedded inside Git objects. An excluded working
file can still exist in retained Git history; do not rewrite or silently filter commits.

A worktree or submodule can use a `.git` file that points to administration outside
the folder. When Git administration is included, automatically capture the referenced administration and required object
stores as private Git recovery dependencies, with cycle detection and source identity.
Inventory these dependencies separately from folder entries. If they are unavailable,
the folder bytes can still be retained, but functional Git recovery stays incomplete.
This exception does not mean following arbitrary filesystem symlinks.

External targets must belong to the owning repository's canonical administration or
object-store roots already trusted through local project/workspace registration.
Derive that boundary from the existing local registration, not a new allow-list from
project files. Validate the worktree/submodule relationship and every resolved path
against those roots before reading. A `.git`, `commondir` or `alternates` pointer by
itself grants no permission to read another directory. Reject unregistered roots,
unrelated folders and links that escape the allowed roots; report Git recovery as
incomplete. Recheck the boundary during reads so path replacement cannot widen it.
Inspect metadata without running repository hooks, filters or configuration commands.

Restoration retains captured original bytes. Where worktree pointers or device bindings
need a new path, retain the original in the recovery store and record the local mapping
and changed materialized paths in the restore result. Rebuild Git administration links
inside the restored recovery layout; never leave a dependency on the source device.
Do not silently discard config or hooks. Recovery itself must not execute retained
hooks, scripts, provisioning, automations or local extension code. Installation,
activation and execution follow the normal trust and setup flow after recovery.

## Capture and encrypted storage

Use one core recovery owner for each source device's project folder. Each publishes
one current complete manifest through an encrypted private document. List source
identity, capture interval, applied `.pstignore`, exclusions, relative paths, entry
types, metadata, content digests, chunk references and Git recovery dependencies. An encrypted private catalog discovers
these sources. Existing workspace/device identities provide ownership; no second
stored project status is needed.

Keep separate source copies when devices edit independently. A restored device
publishes its own source entry. Never let one device's upload overwrite another's
unsent work through an arbitrary latest-device or wall-clock rule.

Read every included entry. Watch filesystem changes, including `.pstignore` edits and writes by external tools, to
schedule capture. Reconcile with a full scan on startup, reconnect, watcher overflow
and an explicit “Back up now” action. Persist pending work across restarts. Watch
notifications are hints, not proof that all entries were scanned.

Read changing files and Git state again before completing capture. A scan error is
never interpreted as a deletion. A successful complete scan represents a deletion
by absence from the new manifest. A rename is a removed path and an added path that
can reuse content. Unreadable or continuously changing entries keep current work
pending while the previous complete capture remains restorable.

Ordinary scans are not one atomic instant across unrelated external writes. Show
the capture interval. Preserve platform atomic multi-file save boundaries (R4).
Include database files unless excluded by `.pstignore`, but do not promise an application-consistent image
of a running external database. Its changing or unverified files remain pending.

Split large files into independently encrypted bounded chunks and use resumable blob
storage. Reuse unchanged chunks only within the same encryption space. Do not expose
plaintext hashes or deduplicate across accounts on the relay. Persist manifests and
ciphertext references durably; publish a completed cloud manifest only after all
referenced blobs are acknowledged (R21). Interrupted transfers resume with the same
references. Failure never replaces the previous completed capture with a partial one.

Keep the recovery service's own cache, manifests and staging outside captured roots.
If the configured runtime home overlaps the project folder, relocate that service's
working storage outside it before capture or report a setup error. Do not silently
exclude a project subtree or recursively back up the capture's own output.

R20/R21's grace period protects referenced blobs during replacement. Relay retention
is latest state plus the grace copy, not a permanent history of captures. Define
participation of these owners in R53's client history during implementation; do not
claim the existing snapshot code already covers folder captures.

## Download and restore

Each user's devices automatically download their completed source captures and bytes
into a local recovery store, even before choosing a project folder. This preserves
offline recovery under R1. It does not project another device's edits or deletions
into an active folder. List source devices and capture intervals so a person can
choose a recoverable copy without depending on the source device being online.

Restore into a new, absent destination. Refuse an existing destination without writes,
even when empty. Offer a new sibling folder or the existing attach workflow. Attaching
local work is not restoration. When the project already has a folder, restore another
source as a separate workspace and keep the current folder attached.

Validate the entire manifest and destination capabilities before publication. Check
path traversal, case collisions, reserved names, permissions and unsupported entry
types. Preserve symlink target text, but never follow restored links for writes.
Use a sibling staging directory on the same filesystem, an operation journal and
resumable verified downloads. Publish with a platform-supported no-replace operation;
a check followed by an ordinary replacing rename is insufficient. Concurrent creation
of the destination must preserve that work and leave restoration incomplete.

Attach only after all entries and Git dependencies are verified and publication is
complete. Reconcile local device bindings without erasing the retained original files.
Pause live file projection and extension setup until restoration and binding are
complete. The resulting setup flow must respect the execution boundary above.
Cancel removes only staging owned by the operation. A partial folder is never ready.

## Progress and interfaces

Extend the existing derived sync state. Cloud UI and CLI/API expose the same data:

- The project-folder boundary, applied `.pstignore`, excluded paths/rules, source
  device, audience and Git dependencies.
- Last completed capture, its interval and counts, plus files and bytes pending since.
- Per-entry read, transfer, quota, integrity or metadata problems, with an action needed.
- Separate progress for records, folder upload, local download and restoration.

A record download cannot imply that folder bytes are complete. Show a previous
completed copy alongside newer pending work. Count `.pstignore` exclusions separately
from the included-file denominator. Credentials, size limits and errors never silently
remove an included file. Offline restoration is
ready only when every required entry is available locally. Records remain usable
without a folder.

Core owns scanning, manifests, transfer, authorization and restoration. The public
SDK/API supports inspection, capture, source listing, download, restore, cancellation
and progress. CLI commands use the same methods; the Cloud extension owns its UI.
Keep additions next to released folder APIs and follow extension API deprecation
rules; do not silently change the existing `clone` input contract.

## PRD reconciliation and delivery

The user's coverage instruction replaces the previous working-tree exclusion in
PRD 0014. R57–R59 record folder coverage controlled by `.pstignore`, its private audience and the first
restore workflow. R2 distinguishes shared editable files from captured source trees;
R43 retains local override files without activating their code as published extensions.
There is no outstanding coverage decision or separate Git-history approval gate.

PS-960 supplies the design requested by its ticket. Runtime implementation still
needs core capture/manifests and Git dependencies, bounded transfer and progress,
safe restore APIs, then Cloud UI and the new-device flow. UI work follows Canvas
policy; this documentation correction changes no visual implementation. Update user
guides when behavior ships. The 5 GiB workload, 1 GiB file and hosting target still
apply; keep the required benchmark files included and do not use ignore rules to
shrink the benchmark workload or raise budgets.

Implementation acceptance must prove:

1. Two isolated runtimes recover all non-Git text, binary, hidden and new files,
   directories and supported metadata with no Git host or online source device.
2. The starter `.pstignore` skips nested `node_modules` folders and copies itself.
   `.env`, keys and other Git-ignored files recover unless explicitly excluded in
   `.pstignore`. Existing policies are not overwritten; deleting or emptying one
   removes exclusions. Restore on a new device preserves the applied policy, including
   deliberate absence, without regenerating starter rules. Custom globs, negation and
   non-Git projects follow the same rules.
   Excluded files are not read/uploaded, while included failures remain blockers.
3. Full Git state restores saved edits, staged content, unpushed and detached commits,
   reflogs and local config. Linked worktrees and submodules recover without source
   paths; excluded or blocked Git dependencies never appear as functional Git recovery.
   Crafted administration pointers, alternates and link replacement cannot capture
   unrelated local directories outside the registered repository boundary.
4. Watcher loss, restarts, deletes, renames, unreadable and changing files produce the
   specified state. Interrupted transfers preserve the previous complete capture;
   quota, disk and integrity failures never mark partial included data complete.
   Policy edits re-scan coverage without deleting local files; interrupted or invalid
   policy changes cannot publish a manifest with mismatched rules and entries.
5. Independent device copies remain restorable, and only the owner's devices can
   decrypt folder captures, including private paths embedded in Git history. Relay
   dumps reveal no known names, credentials or bytes.
   Removing a device stops future access and key delivery but leaves its previously
   downloaded files and old keys usable, as R15/R37 require.
6. Existing destinations, concurrent creation, traversal, symlinks, case collisions
   and interrupted publication preserve local work and cannot attach partial folders.
   Restored hooks, scripts and local overrides never execute during recovery.
7. CLI/API and a critical Playwright folder/download scenario expose the same choices,
   errors and progress. A 1 GiB file does not block record sync or another account.
