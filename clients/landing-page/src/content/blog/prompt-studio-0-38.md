---
title: "Prompt Studio 0.38"
description: Choose where a tool runs, upgrade or reload your extensions, and keep agent conversations going. Highlights from the September 29 releases, 0.37 and 0.38.
published: 2026-09-29T21:15:47Z
author: aurelien-franky
image:
  light: ../../../../../design/art/blog-prompt-studio-0-38-light.png
  dark: ../../../../../design/art/blog-prompt-studio-0-38.png
---

Building a useful tool is a loop: ask for it, try it, change it, and run it again. The two releases on September 29 make that loop easier to manage. This post brings the changes in **0.37 and 0.38** together under the latest version, **0.38**.

0.38 adds a shared workspace input to extension commands, so you can choose the environment before work starts. Earlier that day, 0.37 added extension update and repair controls, conversation fixes, and signed Windows installers.

## Choose the environment before starting

Before this release, an extension needed its own way to collect workspace choices. Now its command can declare a `workspace` parameter. Prompt Studio builds the input from the available providers, using the same choices and fields as **Create workspace**.

A workspace is the environment where work runs. A separate Git worktree, for example, lets an agent make changes on its own branch while you keep working in the project folder. The available types come from your installed workspace providers.

![Animation opening a Planner Run attempt form and selecting feature/reading-list as its Git worktree base branch](../../../../../documentation/images/workspace-command-choices.gif)

*Recorded in 0.39 with a sample Planner ticket. The shared workspace parameter ships in 0.38; Planner's Run attempt choices are restored in 0.39. This recording shows the resulting form and stops before running an agent.*

For a tool author, this means less form code and one place for provider-specific inputs. For the person using the tool, it means choosing the environment before the command starts, rather than discovering afterward that it used the wrong one.

The parameter can also be supplied as structured JSON through the CLI. [CLI-ready actions](/docs/guides/extensions/cli-ready-actions/#use-typed-inputs-and-readable-results) explains how an agent passes the same workspace choice.

## Load the next version of your tool

The 0.37 update to extension settings distinguishes two kinds of update. An installed tool with a newer release offers **Upgrade**; **Upgrade all** updates all installed extensions that have newer versions. A local tool whose source has changed offers **Reload**, which validates and loads that project's files.

You can also drop an extension folder into settings. Prompt Studio copies it into the project's `.pstdio/extensions` folder and loads it there. The project gets its own copy of the tool.

![Animation reloading changed local extension source in settings and opening Contributions to see its updated command title](../../../../../documentation/images/reload-local-extension.gif)

*Recorded in 0.39 using a disposable local extension. Its source was edited before recording. Reload adopts the change; the Contributions tab shows the updated command. These update and repair controls ship in 0.37.*

When a local tool fails to load, **Reload** reports the actual validation error for that project's source. Failed extensions also offer **Copy error**, and **Upgrade** when available. This gives you something concrete to pass to the agent fixing the tool.

The repair loop is concrete: read the error, ask the agent to fix that source, and reload the result. See [extension installation and loading](/docs/references/extensions/manifest-and-installation/) for the rules.

## Keep a conversation going after a problem

The conversation improvements in 0.37 put chat problems in the conversation, where the affected work is visible. A message that could not be sent remains as **Not sent**, and temporary failures offer **Retry**. You can dismiss a problem you no longer need to see. The first message of a new session no longer blanks for a few frames.

More importantly, a saved conversation and an agent's history can disagree without making the session read-only. Reconciliation keeps the saved conversation, so you can continue instead of hitting **Conversation cannot continue**.

There are fixes for individual harnesses too:

- Codex conversations can continue after code-mode commands.
- An OpenCode question can be answered even when an earlier turn failed.
- Thinking-level selection works again for Claude Code, Codex, and OpenCode. Its icons match the Planner priority colors, with a flame for **Max**.

## Install on Windows, use the CLI anywhere

Since 0.37, Windows users get signed x64 desktop installers and automatic updates. Desktop installations on macOS, Windows, and Linux make the bundled `pst` command available too.

The command line is useful beyond setup. Agents can invoke an extension's declared operations through the same handler its interface uses. If you are building a tool, ask for [CLI-ready actions](/docs/guides/extensions/cli-ready-actions/) alongside its page.

## Smaller fixes and extension changes

- Project navigation stays mounted while selection changes, and settings entries appear as their data arrives.
- Extensions can declare clipboard writes, and tool authors get a shared copy button. The bridge permission makes the intended capability explicit.
- Edited numeric controls save on blur, and **Apply** stays clear of the side-panel button.
- Notes shows its title without an extra navigation label.
- Extension API `alpha.14` requires explicit navigation and resource removal. Use compatible extension builds when upgrading this host release.

The upgrade also repairs duplicate folder registrations. Each folder belongs to one workspace; extra workspaces and older project entries sharing a newer project's home folder are removed. Review this migration in the release notes if your setup contains duplicate registrations.

## Open a terminal in the project you selected

With no workspace selected, a new terminal now starts in the project root. It previously started in the app's working folder.

That removes a common first step: opening a terminal, checking the directory, and changing into the project before doing any work. When a workspace is selected, the terminal still uses that workspace.

## Keep same-name tools separate

Two folders can contain extensions with the same name. Their views could fail to load because their built assets collided. The assets are now scoped to the installed source, so one folder's build does not stand in for another's.

This is useful when you keep a tool in more than one project or try a separate copy while changing it.

## Other 0.38 changes

- Planner workspace badges show the workspace's name. The project-folder workspace reads as the folder name, rather than **default**.
- Remove the separate Planner Automation extension from the Marketplace. Planner owns that workflow.
- Show the Windows download on the website.

These highlights come from both releases’ consumed changesets. See the [0.38 release notes](https://github.com/pufflyai/prompt-studio/releases/tag/pstdio%400.38.0), tagged [0.38 core changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.38.0/packages/pstdio/CHANGELOG.md#0380), and [Planner changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.38.0/extensions/pstdio-planner/CHANGELOG.md#0380). The earlier [0.37 release notes](https://github.com/pufflyai/prompt-studio/releases/tag/pstdio%400.37.0), [core changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.37.0/packages/pstdio/CHANGELOG.md#0370), [UI changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.37.0/packages/ui/CHANGELOG.md#0370), and [Codex](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.37.0/extensions/harness-codex/CHANGELOG.md#0370) and [OpenCode](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.37.0/extensions/harness-open-code/CHANGELOG.md#0370) changelogs cover the update and conversation work. Browse [all changes from 0.36.1 to 0.38](https://github.com/pufflyai/prompt-studio/compare/pstdio@0.36.1...pstdio@0.38.0).
