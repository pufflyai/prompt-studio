---
title: "Prompt Studio 0.39: tools that stay in sync"
description: Shared saved views, clearer navigation, a versioned extension API, and fixes for busy workbenches.
published: 2026-10-01T09:40:43Z
author: aurelien-franky
---

Prompt Studio 0.39 improves the parts that tools share: saved views, navigation, and live updates. It also gives the extension API its own semantic version, so a tool can declare which host APIs it supports.

## Share the view of your work

Saved board views and their defaults now belong to the project. Other clients and agents can use the same saved view instead of each keeping a separate configuration. The platform stores and shares those views; an extension such as Planner still owns what its board means.

Planner also publishes refresh events after tag and option changes, so those changes reach shared board views.

## Find tools and their content

The sidebar gains levels for pages, with header and pinned rows kept visible inside each level. Notes and Sessions get their own lists. You can move into a tool's content without filling the main sidebar with every item.

![Notes open in the workbench, with Reading list selected in its own note list](../../../../../documentation/images/notes-editor.png)

*The Notes extension using its own navigation list. This recent capture shows the 0.39 navigation pattern with sample content.*

Extensions can add native toolbar actions and use commands to supply parameter choices. They can also declare a resource resolver: an open page can then show a resource's current title, icon, and menus when its data changes.

## Keep busy workbenches responsive

Open chats now share one session stream connection. This prevents them from using up the browser's connections and stalling other views. Slow reads keep loading until they finish instead of failing after 30 seconds.

Unchanged extension webview bundles are reused across restarts and checked in the background. Crowded closable tabs shrink before the row scrolls, and picking a session from a tab's menu keeps it in that tab.

## A clearer extension API contract

The extension API starts at `0.1.0`. Extensions can declare a range such as `^0.1.0` to accept compatible additions and fixes without listing individual alpha versions. A new minor API version while the API is below `1.0` can still break compatibility. The [API versioning reference](/docs/references/extensions/api-versioning/) explains the rules.

## Selected changelog

- Share saved board views and defaults across project clients and agents.
- Add sidebar levels, native toolbar actions, and command-backed choices.
- Fix chat and Markdown list numbers of 100 and above being clipped.
- Fix Markdown image insertion after fast keyboard selection.
- Validate workspace provider parameters before creating an environment.
- Restore workspace type and base-branch choices in Planner's **Run attempt** form.
- Restore archived Planner tickets with **Unarchive** or `pst tickets unarchive`.
- Show Opus only once in the Claude Code model picker.

See the [0.39 release notes](https://github.com/pufflyai/prompt-studio/releases/tag/pstdio%400.39.0), the [core changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.39.0/packages/pstdio/CHANGELOG.md#0390), the [Planner changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.39.0/extensions/pstdio-planner/CHANGELOG.md#0390), and the [full change list](https://github.com/pufflyai/prompt-studio/compare/pstdio@0.38.0...pstdio@0.39.0).
