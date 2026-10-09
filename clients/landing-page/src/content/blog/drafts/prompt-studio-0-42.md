---
title: "Prompt Studio 0.42"
description: "Link related resources, use native agent goals and planning commands, install extensions through the host, and receive command results as they arrive."
author: aurelien-franky
category: release
---

**Draft: Prompt Studio 0.42 has not been released.** These highlights cover pending changes and may change before publication.

The planned update adds resource linking controls, native commands in the Codex, Claude Code, and OpenCode harnesses, and shared extension installation. It also lets extension commands stream results, so a tool can show progress before the command finishes.

## Resource links

Resource pages gain **Link resource** and **Related resources** actions. Search the resources exposed by enabled extensions, choose a purpose for the link, and inspect incoming and outgoing links from the current page.

For example, a tool author can expose a document and a task as linkable resources. You can connect them and open the document from the task's related resources instead of searching for it again.

Link changes refresh across clients. If a destination is missing or its extension is disabled, the saved reference remains visible and you can remove the link.

Extensions own their resources and navigation targets. This adds shared controls for resources they expose; it does not automatically add linking to every Planner or Artifacts view.

## Native agent commands

The command interface introduced in 0.41 gains native implementations in the three harness extensions. Commands and controls follow the selected agent's capabilities.

- **Codex goals:** use `/goal <objective>`, then pause, resume, edit, or clear the native goal. Changing the objective during an active operation keeps the current turn running and steers subsequent turns in the same conversation.
- **Codex planning:** use `/plan` to select planning mode. A completed native proposal offers **Approve and implement**, which starts implementation in the same thread after checking the proposal revision.
- **Claude Code:** use native commands, including `/plan` and `/compact [instructions]`. Native questions and approval requests stay connected to the workbench's reply controls.
- **OpenCode:** discover and invoke its native commands. `/compact` and `/summarize` use the selected provider and model; OpenCode's Plan agent does not add a `/plan` alias.

For example, give Codex a goal to update a tool, then edit that goal while it is working. You do not need to start a second conversation to change the objective.

Codex prompts and commands share a persistent native session, preserving the same thread between operations. The implementation requires Codex **0.160.1** within that minor version series; confirm the supported version before publishing this post.

## Extension installation

Dropping an extension folder in the dashboard and running `pst extensions add <path>` use the same host installation process. The host installs dependencies and validates the extension before adopting it.

This gives people and agents the same installation result. When the API runs on another machine, the source goes to that host rather than installing only on the machine running the CLI.

Replacing an installed source requires confirmation in the dashboard or `--force` in the CLI. If validation fails, the existing installed files stay intact, so trying a replacement does not discard the working copy.

For tool authors, `pst extensions check <path>` checks local source without installing it. `pst extensions dev <path>` watches local edits and sends changed source to the host for validation and reload.

## Command streams

Extension authors can declare typed command streams for webviews, SDK clients, and the CLI. A command can emit results as it works and then send its final outcome.

For example, a tool that processes several files can show each file's result as it arrives instead of waiting for the entire batch. This is a building block for tool authors; existing commands need to adopt streaming to use it.

Streams share the client's existing transport and support cancellation. CLI commands use `--stream` to print data events and the final outcome; pressing Ctrl+C cancels the stream.

## Windows and harness setup

- Windows discovery recognizes npm-installed OpenCode and other agent commands, including their command wrappers. A supported agent installation can appear in the picker without a separate executable install.
- Harness checks use the configured process environment and validate CLI versions. Availability and model-listing version probes have bounded waits, so an unresponsive probe does not wait indefinitely.

## Draft sources

These highlights were checked against pending changesets and source at commit [`f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d`](https://github.com/pufflyai/prompt-studio/tree/f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d). They are not published release notes.

- [Resource linking controls](https://github.com/pufflyai/prompt-studio/blob/f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d/.changeset/modern-bottles-kick.md) and [resource owner contracts](https://github.com/pufflyai/prompt-studio/blob/f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d/documentation/references/sdk/0002-resources.md#related-resources).
- [Native harness commands](https://github.com/pufflyai/prompt-studio/blob/f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d/.changeset/gold-bags-fry.md) and [provider mappings](https://github.com/pufflyai/prompt-studio/blob/f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d/documentation/references/extensions/0016-native-harnesses.md).
- [Host extension installation](https://github.com/pufflyai/prompt-studio/blob/f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d/.changeset/fresh-baths-cut.md) and [installation rules](https://github.com/pufflyai/prompt-studio/blob/f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d/documentation/references/extensions/0002-manifest-and-installation.md#installing-and-updating).
- [Typed command streams](https://github.com/pufflyai/prompt-studio/blob/f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d/.changeset/breezy-bottles-camp.md) and [streaming commands](https://github.com/pufflyai/prompt-studio/blob/f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d/documentation/references/extensions/0003-command-and-process-api.md#stream-command-output).
- [Windows npm discovery](https://github.com/pufflyai/prompt-studio/blob/f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d/.changeset/proud-coats-tease.md) and [harness environment and version checks](https://github.com/pufflyai/prompt-studio/blob/f3a7a30166a81bbf6843a5d1ceda6907c5e1ef0d/.changeset/metal-geckos-sniff.md).
