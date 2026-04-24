---
layout: ../../../layouts/docs-layout.astro
title: Configure agents
description: Set up, update, and remove coding agents. Install skills and plugins.
htmlTitle: Configure agents
htmlDescription: Install Prompt Studio's agent skills and plugins, change defaults, and override the agent binary path.
section: Guide
category: Customization
categoryOrder: 6
order: 1
---

## Before you start

Prompt Studio does not ship an LLM or an agent CLI — it drives the agent tools already on your machine. Before running setup:

1. **Install the agent binary.**
   - Claude Code: see [Anthropic's install guide](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview). Verify with `claude --version`.
   - OpenCode: see the [OpenCode docs](https://opencode.ai). Verify with `opencode --version`.
2. **Sign in to the agent.** Run it once (`claude`, `opencode`) to complete auth or provide an API key. Prompt Studio launches the binary as-is and inherits whatever auth state it has.
3. **Check the agent can reach a model.** Ask the agent a trivial question in its own CLI before wiring Prompt Studio on top.

You can confirm Prompt Studio sees the agent with:

```bash
pstdio agents list
```

Each agent reports `INSTALLED`, `AVAILABLE`, or `UNAVAILABLE`. `INSTALLED` is the state you want before running `setup`.

## Setup

Install Prompt Studio's agent skills and plugins into a known agent:

```bash
pstdio agents setup claude-code
pstdio agents setup opencode
```

By default, skills and plugins are installed per-project under `.pstdio/`. Install them globally (into the agent's user config) instead:

```bash
pstdio agents setup claude-code --global-skills --global-plugins
```

Global installs are useful if you use the same skills across many projects and don't want to re-install each time.

## Update

Change agent metadata:

```bash
pstdio agents update claude-code --default
pstdio agents update opencode --binary /opt/homebrew/bin/opencode
pstdio agents update claude-code --skills-dir /abs/path/to/skills
```

- **`--default`** — make this agent the default for session creation.
- **`--binary`** — override the resolved binary path (useful when the agent is installed outside of `PATH`).
- **`--skills-dir`** — override the skills directory Prompt Studio reads from.

## Remove

```bash
pstdio agents remove claude-code
pstdio agents remove claude-code --delete-skills
```

`--delete-skills` removes the skills Prompt Studio installed during setup.

## Re-install skills or plugins

If skills or plugins drift from what Prompt Studio expects (for example after upgrading the CLI), re-install without re-running the whole setup:

```bash
pstdio agents install-skills claude-code
pstdio agents install-plugins claude-code
```

Add `--global-skills` / `--global-plugins` to target the global install.

## Dashboard

Global agent settings appear under **Settings → Agents** (the gear icon in the top-right of the dashboard):

![Global agent settings](/images/docs/global-settings-agents.png)

## Related pages

- [`pstdio agents` reference](/docs/reference/cli/agents/) — every CLI option.
- [`client.agents` SDK reference](/docs/reference/sdk/client/#clientagents).
- [Templates, skills, and plugins](/docs/concepts/templates-skills-plugins/).
