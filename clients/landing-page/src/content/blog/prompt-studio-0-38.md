---
title: "Prompt Studio 0.38: clearer workspaces"
description: Shared workspace choices for extension commands, terminals that start in the right folder, and more reliable extension loading.
published: 2026-09-29T21:15:47Z
author: aurelien-franky
---

A tool that starts work for you needs to make clear where that work will happen. Prompt Studio 0.38 adds shared workspace choices for extension commands and fixes two cases where the wrong folder got in the way.

## Let commands ask where to work

Extensions can now declare a `workspace` command parameter. Prompt Studio presents the workspace type and its fields, such as the base branch, using the same choices as **Create workspace**. Tool authors can use the platform's workspace input instead of building their own form.

A workspace is the environment where work runs. A separate Git worktree, for example, lets an agent make changes on its own branch while you keep working in the project folder. The available types come from your installed workspace providers.

![New conversation panel with a Project folder workspace selector above the message composer](../../../../../documentation/images/new-conversation.png)

*Recent capture of the conversation composer, showing which workspace an agent will use. This is the existing session selector; the new command parameter brings workspace type and provider fields to extension command forms.*

The new parameter is a platform capability. Planner's **Run attempt** form gets its workspace type and base-branch choices restored in [0.39](/blog/prompt-studio-0-39/).

## Fix the folder surprises

New terminals now start in the project root when no workspace is selected, rather than in the app's working folder. Extensions with the same name in different folders also load their views correctly: their built assets are scoped to the installed source.

If you use the Planner extension, ticket workspace badges show the workspace's name. The default workspace therefore reads as your project folder's name instead of **default**.

## Selected changelog

- Add the shared `workspace` parameter to the host, SDK, and workbench.
- Open terminals in the project root when no workspace is selected.
- Fix view loading for same-name extensions installed from different folders.
- Show useful workspace names on Planner ticket badges.
- Remove the separate Planner Automation extension from the Marketplace. Planner owns that workflow.
- Show the Windows download on the website.

See the [0.38 release notes](https://github.com/pufflyai/prompt-studio/releases/tag/pstdio%400.38.0), the [core changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.38.0/packages/pstdio/CHANGELOG.md#0380), the [Planner changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.38.0/extensions/pstdio-planner/CHANGELOG.md#0380), and the [full change list](https://github.com/pufflyai/prompt-studio/compare/pstdio@0.37.0...pstdio@0.38.0).
