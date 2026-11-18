# Temporary keyboard scrolling for menus with ScrollArea

Proposed: 2026-11-17
Status: Accepted

## Context

Bounded menus use the shared ScrollArea. Menu content owns keyboard navigation and
its `aria-activedescendant`, while a nested ScrollArea viewport owns scrolling.
Zag Menu 1.35.3 only calls native `scrollIntoView` when the menu content itself is
scrollable. With the nested viewport it skips that call: End highlights an
invisible last row.

## Decision

The shared scoped Menu.Content observes its public `aria-activedescendant` and
reveals that row when it belongs to a nested ScrollArea viewport. It uses native
nearest scrolling and leaves selection, focus, pointer events and ordinary menus
with their existing owners. Extensions use the shared menu without local scroll
handlers or dependency imports.

The regression is the Saved versions control in the Menu selection Canvas:
End reveals the last row, Enter selects it and restores trigger focus, and Home
reveals the first row again.

## External limitation

The ideal behavior is owned by Zag's menu navigation. Its current scrollability
guard checks the menu content rather than the row's actual scroll ancestor. This
adapter uses public ARIA and ScrollArea DOM attributes, without patching private
menu state.

## Removal

Remove the adapter when the supported menu dependency reveals highlighted rows in
nested scroll viewports. Retain the keyboard visibility regression and verify it
against the replacement before removing this integration.
