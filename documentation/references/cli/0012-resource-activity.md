# Resource Activity

Resources explicitly opt into core discussion, meaningful changes, or structured work outcomes. An absent capability has no feed, composer, queries or observations. Sessions keep their conversation without Activity. Planner tickets enable discussion, changes and outcomes; Notes enable discussion.

Use a complete resource reference containing `projectId`, `extensionId`, `type` and stable `id`. The owner authorizes access. Activity never changes ticket Markdown. Large bodies and attachments use core-owned assets and sync through the core Activity record owner, independently of extension enablement. The SDK shares the existing client event transport; no per-resource physical SSE connection is opened.

## Workbench

Activity shares the document editor's width and starts after a separator. Comments use the session message color and compact input controls. Domain changes appear as timeline events with their actor and preserved value labels. Retrieval errors stay beside the feed with retry and dismissal controls.

Attach files to see their names before sending. Files can be removed or sent without text. Uploads remain associated with their resource across navigation, and sending waits for the selected upload batch. A failed batch keeps completed files and identifies the failed file.

Reply, resolution and handoff operations remain available through the API and CLI.

## Commands

```sh
pst resources activity list --resource '<ResourceRef JSON>' --limit 50
pst resources activity read --resource '<ResourceRef JSON>' --id <entry-id>
pst resources activity publish --resource '<ResourceRef JSON>' --file <entry.json>
pst resources activity resolve --resource '<ResourceRef JSON>' --id <discussion-id> --resolved=false
pst resources activity attach --resource '<ResourceRef JSON>' --file <evidence.log> --mime-type text/plain
pst resources activity download --resource '<ResourceRef JSON>' --id <attachment-id> --file <evidence.log>
pst resources activity handoff --resource '<ResourceRef JSON>' --id <comment-id>
```

Publication JSON contains a stable retry `key`, `kind`, and `body`; comments may use an empty body when they include an attachment. Optional `quote`, `replyToId`, and `attachmentIds` add context. Outcomes include `revision` with workspace ID, source session ID, exact head and base SHAs, and revision number. Reviews name `implementationId`, a `verdict`, and optional structured `findings`. Validation, unfinished work, shortcuts and blockers remain addressable on the entry. A later revision cannot inherit an earlier approval. See the shipped `use-resource-activity` skill for complete examples.

Handoffs require one canonical installed harness/model target on a root comment and a separate explicit confirmation. Cancellation starts no session. Failures preserve the comment. Retries reuse the entry's linked session and execute only on the comment's original device.

## Extension API

Declare `activity: { comments: true, changes: true, outcomes: true }` on a resource kind, selecting only supported capabilities. `authorizeActivity` optionally returns `{ allowed, reason? }` for resource-scoped operations. `activityContext` returns `{ text }` for confirmed agent handoffs. Supply the resource's normal `resolveMany` command so missing or unavailable resources cannot be queried.

`ctx.activity` exposes `capabilities`, `query`, `get`, `publish`, `resolve`, `attach`, `readAttachment`, and `handoff`. The same methods are on `client.activity`, which additionally provides `watch`. Only the resource owner can publish domain changes or call `ctx.activity.importEntry` to preserve historical authorship, timestamps and source references. Core stores outcomes; extensions interpret their workflow meaning. Existing `ctx.activity.record` remains supported for audit events.

## Reports compatibility

New Planner submissions use `--change-request-activity-id` and reviews use `--review-activity-id`. Existing report parameters remain deprecated compatibility inputs. `pst pstdio-planner migrate-ticket-outcomes --id PS-12` preserves historical bodies, files, authors, timestamps and exact revision associations, then replaces Reports bodies with verified Activity references. RP identities and aliases remain owned by the compatibility extension. Migration can resume after interruption; reports without an unambiguous owner remain in compatibility storage. New workflows do not require Reports installed.

*Updated at: 2026-11-12*
