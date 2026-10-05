---
title: "Prompt Studio 0.37: easier updates"
description: Signed Windows installers, clearer extension updates, and fixes that help agent conversations continue.
published: 2026-09-29T08:35:40Z
author: aurelien-franky
---

The tools you build should be easier to keep running than the scripts they replace. Prompt Studio 0.37 makes installation and extension repair clearer, and fixes several problems that interrupted agent conversations.

## Install and update your tools

Windows users now have signed x64 desktop installers and automatic updates. Desktop installations on macOS, Windows, and Linux also make the bundled `pst` command available, so you can use the same command line interface that agents use.

In extension settings, **Upgrade all** updates installed extensions that have newer versions. Individual rows offer **Upgrade** when an update is available. You can also drop a local extension folder into the settings page to copy it into your project's `.pstdio/extensions` folder.

![Installed extensions in settings, with an enable switch and a drop zone for adding a local extension folder](../../../../../documentation/images/extension-settings.png)

*Recent capture of extension settings. The drop zone adds a local tool; upgrade buttons appear when an update is available.*

When a local tool fails to load, **Reload** reports the actual validation error for that project's source. Failed extensions also offer **Copy error**, and **Upgrade** when available. This gives you something concrete to pass to the agent fixing the tool.

## Continue the conversation

Chat errors now appear in the conversation. A message that could not be sent stays visible as **Not sent**, and **Retry** is offered for temporary failures. The first message in a new session also stops flickering.

The release fixes conversations that became read-only when saved history and agent history disagreed. The saved conversation now wins during reconciliation. Codex sessions can continue after code-mode commands, and answering an OpenCode question no longer fails because an earlier turn failed.

## Selected changelog

- Restore thinking-level selection for Claude Code, Codex, and OpenCode.
- Keep project navigation mounted while selection changes, and show settings entries as their data arrives.
- Add declared clipboard writes and a shared copy button for extension authors.
- Require explicit navigation and resource removal in extension API `alpha.14`. Use extension builds that declare compatibility with that API.

The upgrade also cleans up duplicate folder registrations: extra workspaces and older project entries that share a newer project's home folder are removed. Check the release notes and back up the affected project state before upgrading if your setup has duplicate registrations.

See the [0.37 release notes](https://github.com/pufflyai/prompt-studio/releases/tag/pstdio%400.37.0), the [core changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.37.0/packages/pstdio/CHANGELOG.md#0370), and the [full change list](https://github.com/pufflyai/prompt-studio/compare/pstdio@0.36.1...pstdio@0.37.0). The [Codex](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.37.0/extensions/harness-codex/CHANGELOG.md#0370) and [OpenCode](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.37.0/extensions/harness-open-code/CHANGELOG.md#0370) changelogs cover their conversation fixes.
