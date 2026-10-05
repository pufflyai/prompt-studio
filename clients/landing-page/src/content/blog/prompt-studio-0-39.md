---
title: "Prompt Studio 0.39"
description: Navigate inside your tools, share saved board views, and keep several agent conversations open without stalling the workbench.
published: 2026-10-01T09:40:43Z
author: aurelien-franky
image: ../../../../../design/art/blog1.png
---

Open Notes, and the sidebar becomes your note list. Open Sessions, and it becomes your conversations grouped by day. Prompt Studio 0.39 gives a tool room for its own navigation, while keeping the rows you pinned within reach.

This release also shares saved board views across the project, adds native toolbar actions for extension authors, and fixes a connection bottleneck when several chats are open.

## Go inside a tool

Previously, project navigation and a page's content shared one sidebar. A growing list of notes or conversations competed with the tools you were trying to reach.

Now a page can open a **sidebar level**. Its content replaces the project rows. Notes shows your notes; Sessions shows conversations grouped by day. The breadcrumb tells you where you are. Click the project name to return to the project and its main navigation.

![Animation opening Notes, switching between notes, returning through the project breadcrumb, and opening Sessions while a pinned Tickets row stays visible](../../../../../documentation/images/nested-sidebar-navigation.gif)

*A real 0.39 workbench recording with sample notes. Tickets is pinned to the header, so it stays available inside Notes and Sessions. The project breadcrumb takes you back out.*

Header and footer rows remain available inside a level, including rows you pinned there. A frequently used tool does not have to disappear when you go into another tool's content. Page-owned lists keep the order their tool provides; customization does not silently reorder your notes or dated conversations.

Sidebar drag and drop gets clearer feedback too. A line marks the insertion point, a group tints when it will receive a row, and you can drop behind a group to move a row back out. Empty header and footer sections remain drop targets. Long customization menus scroll within the window.

Extension authors can use the same navigation pattern in their own tools. See [sidebar levels](/docs/references/extensions/contribution-api/#sidenav-levels).

## Share the view, not just the underlying items

A saved board view and its default now belong to the project. Save a useful way to look at the board, and another client or agent can use that same saved configuration. It no longer lives only in one client's settings.

Prompt Studio supplies the saved-view storage and commands. The extension owns the work shown on the board: Planner, for example, owns its tickets and tags. Planner now emits refresh events when tags or their options change, so open board views pick up those edits.

This matters when you ask an agent to work with a view you already use. It can read the project's saved view through the [board-view CLI](/docs/references/cli/board-views/), rather than guess how your screen is configured.

## Give your tool native actions

Extensions can add toolbar actions to native views and ask commands to provide parameter choices. A table can offer an action next to its content, and its form can load choices from the tool's actual data.

The operation still belongs to a declared command. Connect the view to that command, and make it [CLI-ready](/docs/guides/extensions/cli-ready-actions/) when an agent should invoke the same operation. You do not need a custom webview just to add a toolbar button.

Resource kinds can also declare a resolver command. When an open resource changes, its page can show the current title, icon, and menus. Menus on trees and cards now check the resource you clicked, rather than accidentally taking metadata from the page already open.

## Keep several conversations open

Open chats now share one session stream connection. Previously, enough open chats could use up the browser's connections and leave other views waiting. The shared connection removes that bottleneck.

A slow view read also stays in its loading state until it finishes. It no longer fails just because 30 seconds passed. Unchanged extension webview bundles are reused across restarts and checked in the background, reducing repeated startup work.

Crowded closable tabs shrink before the row scrolls. Choosing a session from one tab's menu keeps it in that tab, and opening a resource that already switched in place reuses its existing tab.

## More fixes in this release

- Chat and Markdown lists show numbers of 100 and above in full.
- Markdown image insertion works after a quick keyboard selection.
- Workspace provider parameters are validated before an environment is created.
- Planner's **Run attempt** form lets you choose the workspace type and base branch again.
- Archived Planner tickets can be restored through **Unarchive** or `pst tickets unarchive`. Ticket menus distinguish active and archived items, and translated menus say **Archive** for a single ticket.
- The Claude Code model picker lists Opus once when the CLI reports both its default model and Opus.

## An API version your extension can declare

The extension API starts its own semantic version at `0.1.0`. An extension can declare `^0.1.0` to accept compatible additions and fixes, instead of naming individual alpha versions. The bundled extensions adopt this range.

While the API is below `1.0`, a new minor API version can still break compatibility. Check the [API versioning reference](/docs/references/extensions/api-versioning/) when updating a tool's supported range.

These highlights come from the released changesets. The [0.39 release notes](https://github.com/pufflyai/prompt-studio/releases/tag/pstdio%400.39.0) include the full package list. See the tagged [core changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.39.0/packages/pstdio/CHANGELOG.md#0390), [Planner changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.39.0/extensions/pstdio-planner/CHANGELOG.md#0390), and [all changes since 0.38](https://github.com/pufflyai/prompt-studio/compare/pstdio@0.38.0...pstdio@0.39.0).
