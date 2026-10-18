# Client and HTTP conventions

These replacement contracts belong to PS-806’s 0.44 implementation. Extension adoption requires
the published 0.44 SDK and matching workbench. Older releases do not provide these replacements.

The public `@pstdio/sdk/client` uses camelCase JSON, project scope first, and bounded collection
pages. The 0.44 release keeps the old fields and calls. Remove those aliases in 0.45 after adoption.
The [removal inventory](0020-api-0-3-removal-inventory.md) lists their callers and replacements.

## Pages

Every canonical collection read returns `{ items, nextCursor: string | null }`. A terminal page
always includes `nextCursor: null`. New resource and catalog queries default to 50 items and clamp
the requested size to 1–200. Resource links retain their existing maximum of 100.

| Client method | HTTP route |
| --- | --- |
| `projects.query(input?)` | `GET /v1/projects/query` |
| `workspaces.query(projectId, input?)` | `GET /v1/projects/:projectId/workspaces` |
| `skills.query(projectId, input?)` | `GET /v1/projects/:projectId/skills/query` |
| `sessions.query(projectId, input?)` | `GET /v1/projects/:projectId/sessions` |
| `views.query(projectId, boardId, input?)` | `GET /v1/projects/:projectId/boards/:boardId/views/query` |
| `views.queryOrphaned(projectId, input?)` | `GET /v1/projects/:projectId/board-views/query?orphaned=true` |
| `views.queryBoards(projectId, input?)` | `GET /v1/projects/:projectId/boards/query` |
| `workspaces.queryProviders(projectId, input?)` | `GET /v1/projects/:projectId/workspace-providers/query` |
| `agents.query(projectId?, input?)` | `GET /v1/agents/query?projectId=…` |
| `agents.queryModels(projectId, agentId, input?)` | `GET /v1/agents/:agentId/models/query?projectId=…` |
| `notifications.query(projectId, input?)` | `GET /v1/projects/:projectId/notifications` |
| `resources.queryAnchors(projectId, input)` | `POST /v1/projects/:projectId/resource-anchors/query-page` |

`ctx.resources.queryAnchors(input)` uses the same required nullable cursor. The old `listAnchors`
method and HTTP `/query` keep their optional string cursor through 0.44. The old notification
`list` type also stays available; `query` guarantees the canonical result even with an older host.

Pass the same scope and filters with each cursor. These are per-read pages, without a stored
snapshot. Project, workspace, skill and catalog pages use stable ID order. New records before the
boundary do not shift later pages; deleted or newly hidden records disappear from later reads.
Session pages keep their creation-time and ID ordering. Saved views keep configured order,
creation time and ID; reordering between reads can change subsequent pages. Removing the boundary
view does not invalidate the cursor. Invalid or foreign cursors restart at the first page.

Saved-view pages contain the views only. The existing board `list` response retains its separate
`defaultViewId` metadata through 0.44. Paging does not change the selected default.

Database collections apply the limit in SQL. Catalog metadata already belongs to the runtime
registry. Catalog pages bound the response and load details for selected entries. Skill pages read
file content only for the selected skills and preserve extension skill precedence over project skills.
This does not add a storage or registry capacity limit; capacity (`documentation/requirements/platform/0010-bound-client-storage-and-isolate-sync-failures.md` in the repository)
owns that separate requirement.

## Project scope and requests

```ts
await client.workspaces.create(projectId, { providerId: "pstdio.worktree", params: { base: "main" } });
await client.notifications.create(projectId, { kind: "info", title: "Ready" });
await client.sessions.create(projectId, { title: "Review", workspaceId });
await client.projects.create({ name: "Notes", initialWorkspace: { providerId: "pstdio.root", params: { path } } });
await client.projects.update(projectId, { defaultAgentId, defaultAgentModel });
await client.filesystem.createDirectory({ parentPath: path, name: "notes" });
```

`projectId` is the query parameter on the old workspace/session routes and agent routes too.
`project_id` and agent `project` remain accepted through 0.44. When both project aliases are given,
they must agree. Canonical session attachment references use `fileId`. Follow-up requests use
`questionResponse`, `summaryFromSessionId`, `summaryFormat` and `summaryRole`.

## Response fields

Sessions and workspaces use the shared `ExtensionSession` and `ExtensionWorkspace` contracts.
HTTP session details add transport metadata such as `projectId`, `agentSessionId`, `sessionFileId`
and `params`. `SessionCreateResponse` and `SessionFollowUpResponse` describe canonical responses;
queued follow-ups expose `followUp.queuePosition`. The old `CreateSessionResponse`, `FollowUpResponse`
and `follow_up.queue_position` remain available through 0.44. Project and skill details use `ProjectDetails`, `SkillDetails` and
`SkillWithContentDetails` from `@pstdio/sdk/resources`.

Activity responses add camelCase `items` and `nextCursor`; deprecated `events` and `next_cursor`
remain available. Use `eventType` as the filter. The event payload is extension-owned JSON and is
not renamed recursively. The same rule applies to command parameters, provider parameters,
settings, saved-view filters and other user data.

## Release gate

These APIs are additive in 0.44. Keep extension adoption in separate PRs against the published
0.44 SDK. Notify Granite maintainers before 0.45, since it uses `createClient` and `client.projects`.
Do not remove a field or method before its stable deprecation release.
