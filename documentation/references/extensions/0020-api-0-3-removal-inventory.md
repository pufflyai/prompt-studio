# API 0.3 removal inventory

The 0.44 release introduces these deprecations. They remain callable until the 0.45 breaking
release. Do not remove an item until its deprecation has shipped in a stable SDK. See
[API versioning](0014-api-versioning.md). Other PS-807 and PS-806 additions extend this inventory
in their owning PRs.

| Deprecated surface | Replacement | Last maintained caller | Data conversion | Removal |
| --- | --- | --- | --- | --- |
| `/extensions` capability constants (`WEBVIEW_*`, `ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES`) | Hosts import from `pstdio-api-contracts`; authors use the typed webview client | Host imports migrated in PS-806 N | None | 0.45 |
| `/extensions` `EXTENSION_EVENTS_SCOPE`, `resolveEventReferenceId`, `artifactMountId` | Host contract exports | Host imports migrated in PS-806 N | None | 0.45 |
| `/extensions` `qualifyNavigationTarget`, page params and URL helpers, `defaultPageResourceCodec`, URL helper types, `resolveDataTable*`, `mergeOrderedHistory` | Host contract exports | Host imports migrated in PS-806 N | None | 0.45 |
| `/extensions` and `/client` `AssetReference`, `AssetTransfer` aliases | `/resources` | Existing external consumers may remain; in-repo code can import the canonical type | None | 0.45 |
| `/extensions` and `/api` notification type aliases | `/resources` | Existing external consumers may remain; command and client result types stay compatible | None | 0.45 |
| `/hooks` `BaseHookContext`, `HookClient`, `HookPayload`, `SessionFollowupInput`, `SessionHookContext`, `WorktreeContext`, `WorktreeCreateContext`, `WorktreeRemoveContext`, `CommitContext`, `RebaseContext`, `MergeContext`, `ConflictContext` and internal hook entity aliases | Typed extension hook contexts from `/extensions` | No maintained extension imports | None; typed host lifecycle slot payloads remain supported | 0.45 |
| `BaseHookContext.payload`, `HookClient.session` and `session.followup` | Typed hook fields and plural SDK `client.sessions.followUp(sessionId, input)` | No maintained extension imports | None | 0.45 |
| `/data` `requireRepoFiles` | Named extension file handle from PRD 0009 | Planner and Reports draft storage; adoption waits for that file API | No conversion in this deprecation PR; file ownership migration is covered by PRD 0009 | 0.45, after replacement ships and callers adopt |
| `/hooks` entry | Typed extension hooks and the regular SDK client | No extension caller | None | 0.45 |
| `/client` workspace/session `listActivity` | Their GET activity HTTP endpoints; use session queries for session history | None in repository source | None; HTTP paths stay available | 0.45 |
| `/client` sessions `getConversationSources` | GET session conversation sources HTTP endpoint | None in repository source | None; HTTP path stays available | 0.45 |
| `/client` skills `updatePreferences` | PUT project skill HTTP endpoint | None in repository source | None; HTTP path stays available | 0.45 |
| `ctx.notify.resolve`, `ctx.notify.dismiss`, author `expired` | `setStatus` and `setStatusByKey` with `done` or `dismissed`; expiry stays host-owned | Planner, Reports and external consumers use the compatibility adapters until 0.45 adoption | None | 0.45 |
| `notification.action`, `.resolve`, `.dismiss` bridge capabilities and parameter types | Invoke a command using `ctx.notify`; keep `notification.show` for toasts | Internal workbench fixture uses `.action`; no maintained extension callers | None | 0.45 |
| HTTP notification `/read`, `/done`, `/dismiss`, `/snooze`, `/resolve-by-dedupe-key`; matching SDK methods | POST `/:id/status` and `/status-by-key`; SDK `setStatus` and `setStatusByKey` | CLI and dashboard compatibility callers; external consumers unknown | None | 0.45 |
| HTTP `PATCH notifications/:id` `snoozedUntil`, `UpdateNotificationInput.snoozedUntil` | Status route with `status: "snoozed"` and a timestamp | External consumers unknown | None | 0.45 |
| Unpaged HTTP `GET /v1/sessions`, SDK `sessions.list` and `ListSessionsInput` | `GET /v1/projects/:projectId/sessions`; SDK `query` or `iterate` with `ExtensionSessionQuery` | CLI session listing; external consumers unknown | None | 0.45 |
| `ExtensionSessionSummary`, `ExtensionSessionResource` and returned snake-case session fields, `last_exit`, snake-case usage totals | `ExtensionSession` and camelCase fields | Planner, Reports, CLI and external callers retain aliases until adoption | No stored conversion; explicit host projection | 0.45 |
| Snake-case `ExtensionWorkspace` fields and `anchors_json`; `CreateExtensionWorkspaceInput` | CamelCase workspace fields, `ExtensionWorkspaceCreateInput`, and `resources` for links | Planner, Reports and external callers | No stored conversion in this PR; stored provider data conversion stays separate | 0.45 |
| `sessions.addAnchors`/`removeAnchors`, `workspaces.addAnchors`/`removeAnchors` | `resources.addAnchors`/`removeAnchors` with a host reference | Planner and external callers; creation anchors stay supported | No conversion; both paths use the same edge table and source transaction | 0.45 |
| `commandOutcomeSchema`, `commandExecuteResponseSchema`, `CommandExecuteResponse` | `validatedCommandOutcomeSchema`, `commandExecutionResultSchema`, `CommandExecutionResult` | External schema consumers; legacy HTTP stream event type | None; preserve Zod object methods and old optional fields during 0.44 | 0.45 |
| SDK `execute` compatibility return intersection | Canonical `CommandExecutionResult` alone | External SDK consumers may access optional fields without narrowing | None | 0.45 |
| `unwrapCommandOutcome` | Check the outcome explicitly, or use `getCommandValue` and `CommandOutcomeError.outcome` | Compatibility consumers until extension adoption | None | 0.45 |
| `createWebviewCommandStream`, `streamExtensionCommand`, `CommandStreamClientEvent`, SDK `extensions.stream`, `CommandStream.result` | Canonical chunk stream with `outcome` and `cancel`; SDK `extensions.streamCommand` | Legacy stream consumers; packaged parity test covers old and new | None | 0.45 |
| Cross-extension registered preference names in `preferences.get`/`set` | Caller-owned names or supported core preferences | External callers unknown; compatibility access warns during 0.44 | None; keep owner values and core preferences | 0.45 |
| Planner public `auto-build candidates` command | `pst tickets next` | Compatibility tests and external CLI callers; internal candidate reader remains an implementation detail | None | 0.45 |
| Planner `expectedAttemptState` parameter and `--expected-attempt-state` flag on submit-change-request and request-human | Ownership and `expectedRevision` for submission; ownership and existing `revision` guard for human requests | Reconcile/submit-review human handoffs and compatibility fixtures | None; retain the human-request state check through 0.44 | 0.45 |
| HTTP workspace `provider_operation_kind: "archive"` value | `"delete"` for new operations | Historical workspace rows and external clients; no new archive operations | Convert stored operation kinds, provider capability JSON and archived provider states in the separate 0.45 conversion PR | 0.45 |

HTTP `capabilities.archive` was deprecated in stable 0.43.1 and removed by PS-805 in 0.44. It is
not a new 0.44 deprecation and must not be restored.

`host.dispatchKeyboardEvent` is private guest plumbing, outside the public capability union.
Keyboard forwarding continues through the private runtime path and requires no declaration.

The API report covers the eight public SDK subpaths from `api-report-entries.json`. `/hooks`
is host-only and deprecated. Export aliases keep their existing type and runtime behavior for the
window above. The 0.45 removal must inspect both SDK exports and real HTTP/bridge registrations.
