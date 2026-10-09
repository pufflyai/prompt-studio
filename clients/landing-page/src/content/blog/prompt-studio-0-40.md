---
title: "Prompt Studio 0.40"
description: "Answer or skip agent questions, restore each project's layout, and preserve elapsed work time across navigation and reloads."
published: 2026-10-06T09:23:44Z
author: aurelien-franky
category: release
image:
  light: ../../../../../design/art/blog-prompt-studio-0-40-light.png
  dark: ../../../../../design/art/blog-prompt-studio-0-40.png
---

Prompt Studio 0.40 adds agent question controls, saves each project's panel layout, and preserves elapsed work time across navigation and reloads.

## Agent questions

A harness can ask through the host's question channel, which marks the session as waiting for you. Pick a suggested answer, choose **Other** to write your own, or **Skip**.

![Question form offering TypeScript, Python, Other, and a Skip button](../../../../../documentation/images/prompt-studio-0-40-question-controls.png)

*Captured in the real workbench with a sample harness to show Other and Skip.*

For example, answer **Rust** when the agent suggests TypeScript or Python. Single-choice questions submit one answer, and question IDs keep replies attached to the correct pending question.

Live replies depend on the harness's protocol. See the tagged [question channel and reply contract](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.40.0/documentation/references/architecture/0002-agents.md#session-execution).

## Session status and settings

- The Claude Code harness keeps its session running while waiting for its own background task, then reports the result. It no longer looks finished while that work continues.
- The work timer preserves elapsed time across navigation and reloads.
- Selected harness parameters are remembered when reopening a conversation or starting a new session.

## Project layouts

Each project preserves its layout, including the Side Panel, across project switches, reloads, and desktop restarts. Keep a reference beside chat in one project and more editor space in another.

The project breadcrumb returns from a tool's sidebar to the last root-level page. Panel menus reopen attached when space allows and float in panels 580 pixels wide or narrower, sized to their content.

## Planner

Use **Open tickets** in Planner's command palette to reach tickets from the action menu without finding the sidebar entry first.

## Harness APIs

The SDK adds `HarnessStartInput.questions`, question correlation through `QuestionResponse.callId`, and optional live replies through `HarnessSession.replyQuestion`. The host manages the waiting state; the harness handles its provider's reply protocol.

Extension API **0.1.1** adds `HarnessProvider.dispose` to release persistent workers or connections on extension reload, disablement, or host shutdown. Ordinary turn completion does not trigger cleanup.

See [persistent worker cleanup](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.40.0/documentation/references/architecture/0002-agents.md#persistent-worker-cleanup) and [API versioning](/docs/references/extensions/api-versioning/).

## Release notes

[0.40 release notes](https://github.com/pufflyai/prompt-studio/releases/tag/pstdio%400.40.0), [core changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.40.0/packages/pstdio/CHANGELOG.md#0400), [SDK changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.40.0/packages/sdk/CHANGELOG.md#0400), [UI changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.40.0/packages/ui/CHANGELOG.md#0400), [workbench changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.40.0/packages/pstdio-workbench/CHANGELOG.md#0400).

[Claude Code harness changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.40.0/extensions/harness-claude-code/CHANGELOG.md#0400), [Planner changelog](https://github.com/pufflyai/prompt-studio/blob/pstdio%400.40.0/extensions/pstdio-planner/CHANGELOG.md#0400), [all changes since 0.39](https://github.com/pufflyai/prompt-studio/compare/pstdio@0.39.0...pstdio@0.40.0).
