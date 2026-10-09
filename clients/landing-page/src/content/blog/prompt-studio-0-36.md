---
title: "Prompt Studio 0.36"
description: "Open folders without Git, share workspaces and sessions between Planner tickets, and recover saved conversations."
published: 2026-09-28T14:33:08Z
author: aurelien-franky
category: release
image:
  light: ../../../../../design/art/blog-prompt-studio-0-36-light.png
  dark: ../../../../../design/art/blog-prompt-studio-0-36.png
---

Prompt Studio 0.36 adds folder-based projects, shared Planner workspaces and sessions, and conversation history recovery.

## Projects and workspaces

Open a folder as a project without registering a Git repository or choosing an agent first. Start with notes or scripts; Git is needed only for workflows such as worktrees.

![Open project folder dialog with folder navigation and an Open folder button](../../../../../documentation/images/open-project-folder.png)

*Captured in 0.39 with a sample folder. Folder-based projects and this dialog shipped in 0.36.*

The project folder is a workspace: the environment where work runs. Installed providers can supply others, such as Git worktrees or remote workspaces.

Notes, Reports, Artifacts, and Planner now use the selected workspace's files rather than assuming they are local. See [projects and workspaces](/docs/guides/concepts/projects-and-workspaces/).

## Planner links

Link related tickets to an existing workspace or agent session, so they share the same work and conversation context. For example, link two tickets to workspace `WS-19`:

```sh
pst tickets link --id PS-1 --workspace WS-19
pst tickets link --id PS-2 --workspace WS-19
pst tickets workspaces --id PS-2
```

Linking does not copy ticket drafts. Unlinking one ticket leaves other links intact; a managed attempt's own workspace and session links are protected.

A shared workspace is archived only after all linked tickets are archived. Project-folder workspaces and providers without archive support stay available.

These workflows belong to Planner. See its tagged [link and unlink commands](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.36.0/extensions/pstdio-planner/docs/cli/tickets.md#link-workspaces-and-sessions).

## Conversation history

Saved history cut short between repeated tool calls is repaired instead of reported as a conflict. The complete conversation is preserved across reads, checkpoints, and resumes.

OpenCode also keeps attachments with their original turn when an earlier turn disappears from its history. Attachments no longer move to another message because its position changed.

## Tool views

Views refresh only when the data they use changes, keeping loaded content visible. Tables clear stale rows when their context changes; trees remember collapsed sections and load only the folder you expand.

On macOS, file watching picks up new dependency directories, so files an agent adds remain visible.

## Other changes

- Single-item Main views omit the redundant closeable tab.
- Ungrouped tools such as Notes appear in the top sidebar section.
- Workspace lists use five default columns, clearer badges and dates, and matching breadcrumb icons; statistics start hidden.
- Extension authoring guidance adds checked composition, webview, and validation examples.
- The same-day **0.36.1** patch skips extension sources a new project does not install and uses shipped lockfiles to install runtime dependencies only.

## Release notes

[0.36 release notes](https://github.com/pufflyai/prompt-studio/releases/tag/pstdio%400.36.0), [core changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.36.0/packages/pstdio/CHANGELOG.md#0360), [Workbench changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.36.0/packages/pstdio-workbench/CHANGELOG.md#0360), [Planner changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.36.0/extensions/pstdio-planner/CHANGELOG.md#0360), [0.36.1 notes](https://github.com/pufflyai/prompt-studio/releases/tag/pstdio%400.36.1), [all changes since 0.35](https://github.com/pufflyai/prompt-studio/compare/pstdio@0.35.0...pstdio@0.36.1).
