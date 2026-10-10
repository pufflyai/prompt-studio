# PRD: Page and mode panel rules

Proposed rules for PS-542's page and mode panels. PS-606 records product decisions before the workbench story implementation.

## Status

Proposed, 2026-10-11. Product-owner answers are pending for sections 1–6. These recommendations are not accepted decisions or evidence of implemented behavior.

| Pending product decision | Blocked implementation |
| --- | --- |
| `[MISSING INFORMATION]` Section 1: fullscreen intent | PS-616 |
| `[MISSING INFORMATION]` Section 2: quiet opens and attention | PS-615; shared visibility policy in PS-610 |
| `[MISSING INFORMATION]` Section 3: reset and preset identities | PS-617 |
| `[MISSING INFORMATION]` Section 4: independent public panel rules | PS-610 |
| `[MISSING INFORMATION]` Section 5: lost-owner recovery | PS-618 |
| `[MISSING INFORMATION]` Section 6: Boombox Up next | PS-610; integrated PS-619 evidence |

The feature branch is `feature/new-workbench-panels`. Each child has a separate draft PR against it. PS-606 comes first; PS-607 through PS-619 follow in dependency order. PS-581 completes only after PS-619 passes. Dashboard and extension migration remain later work.

Ticket support files are stored by Planner and excluded from Git. This document makes the PS-606 decision proposal reviewable in a PR. After acceptance, copy the rules into PS-542's support files and save that ticket with `pst tickets save --id PS-542`.

## Mission fit

Panel ownership, movement, and presentation are shared workbench contracts. An extension cannot enforce them across other tools. People and agents use the same commands and policy. Resource bindings stay intact when tools move, including tools running on other machines.

## 1. Fullscreen and saved visibility intent

Recommendation: explicit Side Open/Close actions in fullscreen update the same saved intent as normal Open/Close. Entering or exiting fullscreen changes presentation only. Do not store a second fullscreen visibility override or snapshot a layout.

The fullscreen controller owns only temporary presentation. The owning panel's open controller writes intent. The shared policy resolver permits or rejects each action before any state changes.

| Case | Recommended result |
| --- | --- |
| Side open, expand Main, close overlay, exit | Side remains closed; its tabs and processes remain. |
| Explicitly open an empty overlay, then close its default tab, exit | Side remains open and empty because direct Open recorded keep-open intent. |
| Reload while expanded | Normal presentation returns; accepted saved panel intent remains. |
| Change mode while expanded | Fullscreen exits; destination mode policy and saved layout apply. |
| Navigate within the same mode | Fullscreen remains active; page-local panels change normally. |
| Enter or exit without a direct panel action | Saved visibility, attachment, geometry, and tab identity do not change. |

Fixed-visible panels still obey their policy. Fullscreen may hide Secondary or a non-floatable Side temporarily. Showing a header never changes those permissions.

## 2. Quiet opens

Recommendation: the call's background origin takes precedence over a view's `reveal: "always"`. Background opens never change visible selection, focus, navigation, or fullscreen. Explicit resource activation may reveal a destination only when its policy allows opening it.

Use one panel visibility intent: `auto`, `open`, `closed`, or `quiet`. `quiet` means background tabs arrived in an empty automatic panel without a request to reveal it. It is not an explicit Close and does not keep an empty panel open.

| Intent | Optional panel visibility |
| --- | --- |
| `auto` | Visible while it contains tabs. |
| `open` | Visible even when empty. |
| `closed` | Hidden, retaining its tabs. |
| `quiet` | Hidden until a permitted explicit panel or resource action reveals it. |

Authored availability and fixed visibility take precedence. A provided fixed-visible panel remains visible; an unavailable panel cannot receive an open.

| Background arrival | Intent and selection |
| --- | --- |
| Empty automatic panel | Change intent to `quiet`; leave active selection unset. |
| Closed populated panel | Preserve `closed` and its active tab. |
| Visible panel | Preserve intent and its active tab; do not select the new tab. |
| Fixed-visible empty panel | Keep the surface visible and leave selection unset; do not replace existing empty content. |
| Inactive mode or page owner | Preserve the active owner and all visible content. |

Direct Open sets `open`. A permitted explicit resource open or edge drop changes `quiet` or `closed` to `auto`, while preserving `open`. Removing the last tab from `quiet` returns it to `auto`. Reset clears the intent override. No separate saved `visible` flag is added.

The panel toggle shows attention until a permitted user action opens or focuses the panel. If no toggle exists, show attention on the mode's existing activity control. If activity chrome is absent or replaced, use the host's mode breadcrumb (the project crumb in the default mode), which remains available independently of extension chrome. Expose the affected panel name to assistive technology. A badge is information; it does not add a forbidden Open action. Attention must survive restoration without revealing the panel. The implementation must define its minimal owner-scoped attention data separately from visibility; it must not use an attention flag as a second visibility source.

The shared tab-open controller owns this transition. Rendering, persistence restoration, and fullscreen use the same visibility resolver. PS-615 must cover all rows and reload through real controllers.

## 3. Reset and tab identity

Recommendation: reset restores declared presets and authored geometry, not a snapshot of the owner's former tabs.

The reset controller resolves existing instances across open owner records before creating any preset. It clears visibility and header overrides and restores permitted authored geometry. Empty-panel defaults are unrelated to reset: they run only on direct opening of an empty panel.

| Case | Recommended result |
| --- | --- |
| Files closed, reset its page | Recreate the declared Files preset in its declared panel. |
| Files moved to Side, reset source page | Focus/open lookup still finds that instance; reset does not move or duplicate it. |
| Foreign session dropped into a page, reset | Preserve its identity, binding, state, and destination owner. |
| Closed declared terminal preset, reset | Create a new terminal resource/session for that preset; never resume the ended session. |
| Open terminal preset, reset | Preserve its tab identity and existing process. |
| Reset mode | Preserve all surviving open tab identities, including moved-in tabs; recreate only closed or absent declared presets. |

Closing a terminal tab ends its session. Closing its panel, navigating, moving the tab, or resetting layout does not end an open session. Stories can prove lifecycle-adapter calls; backend PTY continuity remains an integration gate.

## 4. Independent panel policy

Recommendation: use the following public names. Fields are optional additive declarations; old declarations retain their behavior until the coordinated removal release. This table describes the new contract, not a silent change to existing defaults.

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

The release boundary is explicit: authoritative header behavior applies to the new workbench host contract and its stories first. Extension declarations retain their existing header/tab behavior through host adaptation during the additive release, even when new optional policy fields are present. The coordinated breaking release changes the extension contract's `showHeader` semantics. This proposal does not introduce another manifest flag or silently redefine `alwaysShowTabs`. PS-610 must prove legacy adaptation as well as the new host stories before publishing additive support.

The resolved policy controller enforces the same independent rules in commands, controls, tab drops, whole-panel placement, restoration, reset, and fullscreen.

| Mixed case | Required result |
| --- | --- |
| Fixed-visible Side, togglable Secondary | Only Secondary has visibility controls; both retain their own state. |
| Fixed placement, permitted resize | No move surface or move command; resize works within bounds. |
| Cannot close, accepts tabs | Add/drop works while visible; no Close/Hide/Toggle control. |
| Hidden header, fixed timeline | Show header works; movement, visibility, resize, and add permissions stay unchanged. |

## 5. A containing owner disappears

Recommendation: retain still-valid tabs in their existing recoverable owner records when their containing page, mode, or panel disappears. Their stable identity, resource binding, unsaved view state, and processes survive. They do not become visible in a forbidden panel.

The owner-removal controller distinguishes missing containers from deleted bound resources. The unique-editor resolver searches retained records before creation. On the next explicit resource open, it transfers that same tab using the normal destination rule: use a matching current page slot; only when no matching slot exists, use the view's default provided mode panel. A matching slot that forbids opening or accepting the recovered tab causes failure; do not skip it for another destination. This transfer is a recovery exception to ordinary drag-only ownership changes.

If no destination permits the action, report one actionable failure and preserve the retained record. Do not duplicate, rebind, end its process, or bypass policy. Reset does not pull retained tabs back; it uses the same instance lookup. If a removed contribution returns, its retained records can render again without recreating tabs.

| Removal | Recommended result |
| --- | --- |
| Workspace 1 container removed; foreign Workspace 2 terminal was inside it | Preserve the terminal and its Workspace 2 binding/process; explicit open recovers it to an allowed destination. |
| Containing mode removed | Retain valid tabs; explicit open can recover them in an available owner. |
| Containing panel removed | Retain its tabs without enabling the removed panel; recover individually. |
| Bound resource deleted | Run existing resource-removal lifecycle, including its explicit retention hook for dirty editors. Prune other tabs and close resource sessions as appropriate. A retained deleted-resource editor is not a valid successfully opened resource. |
| View contribution unavailable | Preserve recoverable state, but fail opening until the view exists; do not pretend it rendered successfully. |

The existing owner cache remains authoritative. Do not add a duplicate resource-to-owner index, recovery database table, or second editor. Recovery and removal must commit atomically. PS-618 owns fixture evidence; backend workspace deletion and PTY evidence remain later work.

## 6. Boombox Up next

Recommendation: Up next is a locked mode-owned Side tab, following the user within Boombox. Player stays fixed at the bottom in Secondary. Boombox provides no navigation panel or floating bubble. The package showcase and later Extension Lab migration must declare the same rules.

## 7. Movable workspace tools

PS-542's scenario “Workspace panels are locked except the terminal” contradicts its accepted movable Changes/Files goal. Remove that scenario from the ticket. Changes and Files may move and close; their internal file trees and workspace binding remain with the view. Only explicit structural locks forbid movement.

This correction is already specified by PS-606 and does not require choosing one of the open alternatives.

## 8. Later product decisions

- `[MISSING INFORMATION]` Webview user-action detection for `navigation.open`. The later bridge migration owns the rule; fixture stories pass an explicit call origin and do not decide it.
- `[MISSING INFORMATION]` Whether a workspace page quietly opens its latest session or stops auto-opening it. The later dashboard migration owns the decision.
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
