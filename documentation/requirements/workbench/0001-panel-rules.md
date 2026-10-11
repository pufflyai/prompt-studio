# PRD: Page and mode panel rules

Product rules for PS-542's page and mode panels, accepted through PS-606 before workbench story implementation.

## Status

Proposed implementation, 2026-10-11. The product owner accepted the six rules below in this session. Runtime implementation and the PS-581 story gate remain pending.

| Decision | Accepted answer | Implementation |
| --- | --- | --- |
| Fullscreen | Keep my Sidebar choice | PS-616 |
| Background sessions | Agent starts add sessions to Sessions; they do not open UI tabs | PS-615 |
| Reset | Restore declared tools and layout | PS-617 |
| Permissions | Set each permission separately | PS-610 |
| Owner/resource removal | Closing a tab does not end its session; deleting a resource closes all tabs on its inaccessible page | PS-618 |
| Boombox Up next | Locked Sidebar tab | PS-610; PS-619 |

The feature branch is `feature/new-workbench-panels`. Each child has a separate PR against it. PS-606 comes first; PS-607 through PS-619 follow in dependency order. PS-581 completes only after PS-619 passes. Dashboard and extension migration remain later work.

Ticket support files are stored by Planner and excluded from Git. This document records the accepted rules for PR review. The same rules are saved in PS-542's support files with `pst tickets save --id PS-542`.

## Mission fit

Panel ownership, movement, and presentation are shared workbench contracts. An extension cannot enforce them across other tools. People and agents use the same commands and policy. Resource bindings stay intact when tools move, including tools running on other machines.

## 1. Fullscreen and saved visibility intent

Explicit Side Open/Close actions in fullscreen update the same saved intent as normal Open/Close. Entering or exiting fullscreen changes presentation only. Do not store a second fullscreen visibility override or snapshot a layout.

The fullscreen controller owns only temporary presentation. The owning panel's open controller writes intent. The shared policy resolver permits or rejects each action before any state changes.

| Case | Required result |
| --- | --- |
| Side open, expand Main, close overlay, exit | Side remains closed; its tabs and processes remain. |
| Explicitly open an empty overlay, then close its default tab, exit | Side remains open and empty because direct Open recorded keep-open intent. |
| Reload while expanded | Normal presentation returns; accepted saved panel intent remains. |
| Change mode while expanded | Fullscreen exits; destination mode policy and saved layout apply. |
| Navigate within the same mode | Fullscreen remains active; page-local panels change normally. |
| Enter or exit without a direct panel action | Saved visibility, attachment, geometry, and tab identity do not change. |

Fixed-visible panels still obey their policy. Fullscreen may hide Secondary or a non-floatable Side temporarily. Showing a header never changes those permissions.

## 2. Agent-started sessions

An agent-started session appears in the Sessions list. Starting it does not open a UI tab, including a hidden tab. It does not select a tab, navigate, reveal a panel, add a panel attention badge, move focus, or change fullscreen. A view's `reveal: "always"` cannot turn resource creation into a navigation request.

The session-start/resource adapter owns this rule: publish the session resource to the session list without calling UI navigation. The no-tab rule applies to resource creation, not an explicit navigation command by a person or agent. The workbench tab-open controller handles a later explicit open through the normal instance and destination resolver. Do not add a saved `quiet` visibility value, a hidden session tab, or another visibility flag to represent an unopened session.

| Agent start while… | Required result |
| --- | --- |
| Optional Sidebar is empty and automatic | It stays empty and closed; session appears only in Sessions. |
| Sidebar is explicitly closed with retained tabs | Tabs, selection, and closed intent stay unchanged. |
| Sidebar is visible | Current content and focus stay unchanged; no new tab or badge. |
| Sidebar is fixed visible without a toggle | Existing content stays unchanged; no replacement attention surface is needed. |
| Another page/mode or fullscreen is active | Navigation, presentation, and panel state stay unchanged. |
| The client reloads before the user opens the session | Session remains in Sessions; no session tab is restored from the start event. |
| Explicit user or agent navigation opens the session | Reuse its open view, or create a view bound to that existing session resource at a permitted destination. |

Panel intent remains `auto`, `open`, or `closed`. Authored availability and fixed visibility take precedence. Resource activation reveals a permitted panel automatically; direct panel Open alone records keep-open intent. PS-615 proves the no-tab session-start path in the fixture. Backend event wiring belongs to later dashboard/bridge work.

## 3. Reset and tab identity

Reset restores declared presets and authored geometry, not a snapshot of the owner's former tabs.

The reset controller resolves existing instances across open owner records before creating a preset view. It clears visibility and header overrides and restores permitted authored geometry. Empty-panel defaults are unrelated to reset: they run only on direct opening of an empty panel.

| Case | Required result |
| --- | --- |
| Files closed, reset its page | Recreate the declared Files view in its declared panel. |
| Files moved to Side, reset source page | Keep that instance in Side; do not move or duplicate it. |
| Foreign session dropped into a page, reset | Preserve its view identity, binding, state, and destination owner. |
| Closed declared terminal preset, reset | Reopen a view for its still-valid terminal resource/session using its canonical binding in the owner/closed-tab records. Create a new resource only when the preset has no valid resource. |
| Move declared terminal, close it, reload, reset source | Reopen its same valid resource once at the declared destination. Never choose the latest session or another terminal sharing its launch workspace. |
| Open terminal preset, reset | Preserve its tab identity and existing process. |
| Reset mode | Preserve surviving open tab identities, including moved-in tabs; restore only closed or absent declared presets. |

Closing a session or terminal tab removes its UI placement. It does not end or delete the underlying session. The session/terminal runtime owns stopping execution; tab, panel, navigation, and layout controllers do not. Reopening a closed tab may create a new view instance bound to the same resource. Stories prove lifecycle-adapter calls; backend PTY continuity remains an integration gate.

## 4. Independent panel policy

Use the following public names. Fields are optional additive declarations; old declarations retain their behavior until the coordinated removal release. This table describes the new contract, not a silent change to existing defaults.

| Rule | Mode Side | Mode Secondary | Page bottom |
| --- | --- | --- | --- |
| Provided | Membership in mode `regions` | Membership in mode `regions` | Page declares `bottom` |
| Can open | `canOpen` | `canOpen` | `canOpen` |
| Can close | `canClose` | `canClose` | `canClose` |
| Accepts new/moved tabs | `acceptsTabs` | `acceptsTabs` | `acceptsTabs` |
| Resizable | `resizable` | `resizable` | `resizable` |
| Fixed size | `size.minPx === size.maxPx` | Same | Same |
| Whole-panel movement | `movable` | `movable` | `movable` |
| Floatable | `floatable` | Unsupported | Unsupported |
| Floating bubble | Mode `floatingBubble` | Unsupported | Unsupported |
| Header visible | `showHeader` | `showHeader` | `showHeader` |
| Explicit-empty-open default | `defaultTab` | `defaultTab` | `defaultTab` |

`floating.defaultTab` supplies the floating-open default; retained tabs take precedence. Creation targets are serializable declarations, not executable manifest callbacks. Bubble availability does not grant opening or floating permission.

For the new contract, boolean permissions default to allowed for a provided panel, except unsupported presentation options. `showHeader` defaults to true. A fixed-visible declaration sets authored visibility to open and sets `canOpen: false`, `canClose: false`. A fixed-hidden declaration must not become visible through resource creation or restoration.

Opening and closing are separate permissions. Toggle requires both. One-way Open or Close controls appear only when applicable and permitted. Fixed size and resize permission are independent declarations; equal minimum and maximum leave no adjustable range.

`movable: false` locks geometry, not tab movement. A locked Secondary also forbids moving Main in a way that swaps Secondary. Tab locks remain explicit and independent of resource binding.

Deprecate `collapsible` in favor of the new open/close policy. Its old contract permits explicit hide/show and must remain intact for old declarations until removal. New declarations must not be inferred from `collapsible: false` as though it meant forbidden explicit visibility actions.

Retain `showHeader`, but preserve old declaration behavior during migration. The new panel contract makes it authoritative: a visible header shows the default tab, including a single locked tab; false hides the header until an owner-scoped override restores it. Reset removes the override.

The release boundary is explicit: authoritative header behavior applies to the new workbench host contract and its stories first. Extension declarations retain their existing header/tab behavior through host adaptation during the additive release, even when new optional policy fields are present. The coordinated breaking release changes the extension contract's `showHeader` semantics. This contract does not introduce another manifest flag or silently redefine `alwaysShowTabs`. PS-610 must prove legacy adaptation as well as the new host stories before publishing additive support.

The resolved policy controller enforces the same independent rules in commands, controls, tab drops, whole-panel placement, restoration, reset, and fullscreen.

| Mixed case | Required result |
| --- | --- |
| Fixed-visible Side, togglable Secondary | Only Secondary has visibility controls; both retain their own state. |
| Fixed placement, permitted resize | No move surface or move command; resize works within bounds. |
| Cannot close, accepts tabs | Add/drop works while visible; no Close/Hide/Toggle control. |
| Hidden header, fixed timeline | Show header works; movement, visibility, resize, and add permissions stay unchanged. |

## 5. A containing owner or resource is removed

Closing a tab and ending a session are separate actions. When a resource is deleted, its page becomes inaccessible and all tabs on that page close, including tabs bound to other resources. Do not retain an inaccessible page or orphan tab owner for later UI recovery.

The owner-removal controller removes the page's tab records, selection, and UI ownership together. The resource-removal controller also removes views bound to the deleted resource from other owners and prevents navigation/history/restore from reopening its page. UI cleanup must not stop a foreign session or terminal whose bound resource remains valid. The underlying resource runtime owns deletion and execution lifecycle.

| Removal | Required result |
| --- | --- |
| Workspace 1 deleted; Workspace 2 session/terminal was on its page | Workspace 1 is inaccessible. All its tabs close. The foreign session keeps its Workspace 2 binding and execution. |
| User explicitly opens that valid foreign session later | Open a view bound to the existing session resource at the normal permitted destination. There is no retained tab in Workspace 1 to recover. |
| Mode, panel, or view contribution unregistered | Follow its existing registration/disposal and navigation failure/fallback lifecycle. Cleanup must not stop or delete a valid bound session resource. |
| The bound session/resource itself is deleted | Remove its tabs across owners and reject navigation to the deleted resource. Its runtime owns any execution cleanup. |
| A destination forbids a later explicit open | Report one actionable failure. Do not reveal another panel, recreate a session, or bypass policy. |
| Ordinary page navigation, mode change, or panel Hide | Preserve tabs and their sessions; this is not resource deletion or contribution unregistration. |

A later explicit open uses a matching current page slot; only when no matching slot exists does it use the view's default provided mode panel. A matching slot that forbids opening or accepting the tab fails the operation. Reopening may create a new view instance; the resource/session identity remains the same. Do not promise preservation of a closed view's in-memory draft, cursor, or mount identity. Existing resource/view persistence still applies.

Contribution unregistration is separate from resource deletion. This decision adds no promise to preserve or recover removed-contribution tab state. Keep existing registration/disposal behavior and fallback navigation while applying the separate session-lifetime rule.

The existing owner cache remains authoritative. Do not add a recovery table, duplicate resource-to-owner index, or retained deleted-resource editor exception to this new contract. PS-618 owns fixture evidence; backend resource deletion and PTY evidence remain later work.

## 6. Boombox Up next

Up next is a locked mode-owned Side tab, following the user within Boombox. Player stays fixed at the bottom in Secondary. Boombox provides no navigation panel or floating bubble. The package showcase and later Extension Lab migration must declare the same rules.

## 7. Movable workspace tools

PS-542's contradictory “Workspace panels are locked except the terminal” scenario has been removed. Changes and Files may move and close; their internal file trees and workspace binding remain with the view. Only explicit structural locks forbid movement.

This correction is already specified by PS-606 and does not require choosing one of the open alternatives.

## 8. Later product decisions

- `[MISSING INFORMATION]` Webview user-action detection for `navigation.open`. The later bridge migration owns the rule; fixture stories separate creation from explicit navigation and do not decide bridge heuristics.
- `[MISSING INFORMATION]` Whether workspace navigation opens its latest session. The later dashboard migration owns the decision, separately from agent session creation.
- Backend terminal continuity, browser URL/history integration, installed-extension compatibility, and desktop top-header controls remain later integration checks.

## Validation and release boundaries

PS-606 changes documentation only. Check Markdown formatting, relative links, source paths, policy consistency, and the decision cases. Do not run application tests or add a changeset for this document.

PS-607 adds the fresh story fixture and runnable Playwright story check. Later children add focused failing behavior tests before controller changes and story play functions for UI. PS-619 saves the integrated pass/fail/gap matrix and browser evidence. Passing the standalone HTML mock is not production evidence.

Follow [extension API versioning](../../references/extensions/0014-api-versioning.md): additive replacement and deprecation first, extension migration after SDK publication in separate PRs, then coordinated removal. Keep `extensions/**` out of this feature branch. No old extension contract is removed by this document.

## References

- Planner tickets PS-542, PS-581, and PS-606 through PS-619.
- Planner report RP-374 (`ps-542-adversarial-review`).
- [Mission](../../../MISSION.md).
- [Contribution ownership](../../references/workbench/0003-contribution-ownership.md).
- [Navigation](../../references/workbench/0004-navigation.md).
- [Current mode declarations](../../../packages/pstdio-api-contracts/src/extension-kernel/types/contributions.ts).
- [Owner removal controller](../../../packages/pstdio-workbench/src/core/controllers/page-location/page-owner-removal.ts).
- [Resource removal controller](../../../packages/pstdio-workbench/src/core/controllers/composition/resource-removal.ts).
