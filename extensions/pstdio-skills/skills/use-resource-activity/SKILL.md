---
name: use-resource-activity
description: Read resource discussion and publish implementation or independent review outcomes with evidence and exact revision context.
---

# Resource Activity

Publish on the resource being worked on. A session is context for the work, not an Activity destination. Resource owners opt into discussion, changes, and outcomes; sessions retain their conversation without Activity.

Use the complete resource reference: projectId, extensionId, type, and stable id. Labels and shorthands are not identity. For Planner, read the ticket with `pst tickets panel --id PS-12` and use its stable `id`, the project ID, and `pstdio.pstdio-planner` as the owner.

## Read context

```sh
pst resources activity list --resource '<ResourceRef JSON>' --limit 50
pst resources activity read --resource '<ResourceRef JSON>' --id <entry-id>
```

Pages return `items`, a nullable `nextCursor`, and the unresolved discussion count. Pass `--cursor` for another bounded page. A stale cursor means saved data changed: restart the query and deduplicate by stable entry IDs.

Read relevant discussion and earlier implementation/review entries before acting. Do not copy a session conversation or tool-by-tool narration into the feed.

## Publish work

Write a JSON file with `key`, `kind`, and `body`. Keep the key stable while retrying identical content after a lost response. Use a new key when content changes. `kind` is `comment`, `implementation`, or `review`; domain changes are published by their resource owner.

Implementation and review entries require `revision`:

```json
{
  "key": "implementation-1",
  "kind": "implementation",
  "body": "Explain the problem, resulting behavior, and implementation choice.",
  "revision": {
    "workspaceId": "<workspace-id>",
    "sessionId": "<source-session-id>",
    "headSha": "<exact-git-HEAD>",
    "baseSha": "<exact-dependency-base>",
    "revision": 1
  },
  "validation": [{ "command": "bun test <target>", "result": "Passed; describe relevant evidence" }],
  "unfinished": "None",
  "shortcuts": "None",
  "blockers": "None",
  "attachmentIds": []
}
```

```sh
pst resources activity publish --resource '<ResourceRef JSON>' --file <outcome.json>
```

Keep the returned entry `id`. Outcomes are immutable. Publish a new entry for a correction or a later revision. An approval never carries to a different revision or commit.

For an independent review, set `kind: "review"`, `implementationId` to the exact implementation entry, and `verdict` to `passed` or `changes_requested`. The revision's `sessionId` is the independent reviewer's session. Preserve the implementation's workspace, base, head and revision number. Use `findings` for prioritized findings with `severity`, `body`, and optional `path`, `startLine`, `endLine`, and `side`. A passed review cannot contain unresolved critical or minor findings. Cite useful code and evidence in the body. The implementer does not publish its own independent review.

## Attach evidence

```sh
pst resources activity attach --resource '<ResourceRef JSON>' --file <test.log> --mime-type text/plain
pst resources activity download --resource '<ResourceRef JSON>' --id <attachment-id> --file <destination>
```

Attach screenshots, logs, traces, and other concrete evidence. Put returned attachment IDs in the published entry. Attachments belong to the complete resource identity and are verified by content hash. Large outcome bodies use core-owned assets rather than oversized records.

## Discussion and confirmed handoff

Comments can include `replyToId` for a root discussion, optional preserved `quote` text, and one `target: { harnessId, modelId }` using canonical installed IDs. Publishing a target does not start a session. Start one only after the person's explicit handoff confirmation:

```sh
pst resources activity handoff --resource '<ResourceRef JSON>' --id <comment-entry-id>
pst resources activity resolve --resource '<ResourceRef JSON>' --id <discussion-id>
pst resources activity resolve --resource '<ResourceRef JSON>' --id <discussion-id> --resolved=false
```

Retry the same handoff entry after failure. Its comment remains saved and its session is linked. A handoff belongs to the device where the targeted comment was created; another device must not create a second session for it. Later conversation belongs in that session.

## Historical Reports

New outcomes use Activity; do not create a duplicate Reports outcome. Historical RP references remain readable through Reports compatibility. A resource owner can migrate historical evidence with `ctx.activity.importEntry`; only the resource owner can import original authorship and timestamps.

For Planner history, run `pst pstdio-planner migrate-ticket-outcomes --id PS-12` while the Reports compatibility extension is installed. It preserves bodies, files, original authors, timestamps, revision references and RP identities, then replaces Reports bodies with links to the verified Activity entries. The command can resume after interruption. New Planner submissions and reviews work without Reports installed. Reports with no unambiguous target remain readable in compatibility storage.
