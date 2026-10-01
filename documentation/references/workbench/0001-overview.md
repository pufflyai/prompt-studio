# Workbench

The Workbench package supplies the headless application model and the React shell
used by Prompt Studio. Start with the API reference, then use the focused guides
for navigation and contribution ownership.

## References

- [Workbench API](0002-api.md) covers package entry points, core services, panel
  registration, composition queries, resources, modes, persistence, and extension
  placement.
- [Navigation](0004-navigation.md) explains explicit targets, canonical locations,
  breadcrumbs, and history.
- [Contribution ownership](0003-contribution-ownership.md) explains module and
  extension attribution, lifecycle, and instance ownership.

Extension authors should also read [Extension modes](../extensions/0009-modes-and-layout.md)
and [Dashboard UI attachments](../extensions/0013-workbench-attachments.md).

The live examples are in the `pstdio-workbench/API` section of the Workbench
Storybook.

## Panel menus

Closing an attached panel menu hides it until its header opener is selected. The
opener attaches the menu directly when its panel has room for the menu, other
attached menus, resize handles, and at least 120 px of content. Menu minimum widths
come from their contributions. There is no fixed panel-width threshold.

When attachment cannot fit, the opener shows a floating menu below the button.
The floating menu fills the available viewport height. Increasing panel width
restores attachment for an open menu. Main, Secondary, and Side panel menus use
the same rule.
