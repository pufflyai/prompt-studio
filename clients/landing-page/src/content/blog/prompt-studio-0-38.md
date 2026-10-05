---
title: "Prompt Studio 0.38"
description: Extension commands can ask for a workspace and its provider fields. Terminals and extension views also get fixes for working in the right folder.
published: 2026-09-29T21:15:47Z
author: aurelien-franky
image: ../../../../../design/art/blog2.png
---

An extension command can now ask where its work should run. Prompt Studio 0.38 adds a shared workspace input with the workspace type and the fields its provider needs, such as a Git base branch.

It is a small release with a useful boundary: the tool decides what work to do, and the platform supplies the environment and the form for choosing it.

## Choose the environment before starting

Before this release, an extension needed its own way to collect workspace choices. Now its command can declare a `workspace` parameter. Prompt Studio builds the input from the available providers, using the same choices and fields as **Create workspace**.

A workspace is the environment where work runs. A separate Git worktree, for example, lets an agent make changes on its own branch while you keep working in the project folder. The available types come from your installed workspace providers.

![Animation opening a Planner Run attempt form and selecting feature/reading-list as its Git worktree base branch](../../../../../documentation/images/workspace-command-choices.gif)

*Recorded in 0.39 with a sample Planner ticket. The shared workspace parameter ships in 0.38; Planner's Run attempt choices are restored in 0.39. This recording shows the resulting form and stops before running an agent.*

For a tool author, this means less form code and one place for provider-specific inputs. For the person using the tool, it means choosing the environment before the command starts, rather than discovering afterward that it used the wrong one.

The parameter can also be supplied as structured JSON through the CLI. [CLI-ready actions](/docs/guides/extensions/cli-ready-actions/#use-typed-inputs-and-readable-results) explains how an agent passes the same workspace choice.

## Open a terminal in the project you selected

With no workspace selected, a new terminal now starts in the project root. It previously started in the app's working folder.

That removes a common first step: opening a terminal, checking the directory, and changing into the project before doing any work. When a workspace is selected, the terminal still uses that workspace.

## Keep same-name tools separate

Two folders can contain extensions with the same name. Their views could fail to load because their built assets collided. The assets are now scoped to the installed source, so one folder's build does not stand in for another's.

This is useful when you keep a tool in more than one project or try a separate copy while changing it.

## Other changes

- Planner workspace badges show the workspace's name. The project-folder workspace reads as the folder name, rather than **default**.
- Remove the separate Planner Automation extension from the Marketplace. Planner owns that workflow.
- Show the Windows download on the website.

These highlights come from the released changesets and the release's change list. See the [0.38 release notes](https://github.com/pufflyai/prompt-studio/releases/tag/pstdio%400.38.0), tagged [core changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.38.0/packages/pstdio/CHANGELOG.md#0380), [Planner changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.38.0/extensions/pstdio-planner/CHANGELOG.md#0380), and [all changes since 0.37](https://github.com/pufflyai/prompt-studio/compare/pstdio@0.37.0...pstdio@0.38.0).
