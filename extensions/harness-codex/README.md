# Codex

This extension lets Prompt Studio run OpenAI's Codex as an agent. You write the prompt in Prompt Studio, and Codex does the work in your project.

Prompt Studio calls this kind of extension a harness: it starts an agent program, sends it your prompts, and shows the conversation. Prompt Studio installs this extension by default.

## Install Codex first

Prompt Studio does not include Codex. Install the Codex command-line tool on the computer that runs Prompt Studio, so that the `codex` command works in a terminal:

```sh
bun add --global @openai/codex
codex --version
```

Prompt Studio supports Codex 0.157.0 and newer. An older version shows as unavailable, with the version it found and the version it needs. Update it with `bun add --global @openai/codex@latest`.

Run `codex login` once and sign in. Prompt Studio uses that sign-in and never asks for your OpenAI credentials.

Check that Prompt Studio finds Codex:

```sh
pst agents list
```

The Codex row should say `yes` under **Installed**. Prompt Studio checks this by running `codex --version`.

If you removed the extension, install it again from **Settings → Project → Extensions**, or run `pst extensions add harness-codex` inside a linked project folder.

## Choose Codex

- In a new session, open the model menu in the message box, switch the harness to **Codex**, and pick a model. Prompt Studio remembers your choice for the next session in the project. A session keeps its agent once it has started.
- To make it the project default, open **Settings → Workbench → Runtime** and choose it under **Default model**.
- Planner actions that start agent work, such as **Run attempt**, let you choose the agent in their form.
- From a terminal, pass its ID to `pst sessions create`:

```sh
pst sessions create --prompt "Review this repository" \
  --agent pstdio.harness-codex.harness.codex --model <model>
```

If the `codex` command is missing, Codex shows as unavailable in the model menu.

## Models and reasoning effort

Prompt Studio asks Codex for its list of models, so the menu shows what your Codex account can use.

The **Reasoning effort** option sets how much Codex thinks before it answers: Minimal, Low, Medium, High, or XHigh. The default is Medium. Each model can offer fewer levels or its own default, and models without the option hide it.

## How it runs

- Prompt Studio starts `codex app-server` on the computer that runs Prompt Studio and talks to it over standard input and output. Sessions that use the same `codex` command and environment share one app-server process. Each Prompt Studio session has its own Codex thread.
- Each thread starts in the session's folder with approvals turned off and full file access (`approvalPolicy: "never"`, `sandbox: "danger-full-access"`). Codex can edit files and run commands there without asking first. Use a separate workspace, such as a Git worktree, when you want to keep your project folder unchanged.
- Prompt Studio saves the conversation itself. When it needs Codex's own record, for example after a restart or before it continues an interrupted turn, it asks the app-server with `thread/read`. It does not read Codex's session files directly.
- When Prompt Studio prepares a workspace, it copies the project's enabled skills into `.agents/skills` there. These are copies; edit a skill in the extension that ships it. To install them with the CLI, run `pst agents setup pstdio.harness-codex.harness.codex`. See [Give the agent skills](../../documentation/guides/getting-started/0004-run-agents.md#give-the-agent-skills) for how existing skill files are kept or replaced in each release.
- Commands that Codex runs get `PSTDIO_SESSION_ID` and `PSTDIO_PROJECT_ID` in their environment. When the agent runs `pst` commands, they act for that session and project.

OpenAI labels the Codex app-server as experimental. [ADR 0064](../../documentation/adrs/0064-codex-app-server-runtime.md) explains why Prompt Studio uses it, and how threads, history, and stopping work.

## What is tested

The harness tests replay recorded app-server traffic from Codex 0.157.0 and 0.162.0, and use local test servers for threads, history, questions, goals, and cleanup. CI also starts the installed Codex CLI, at the minimum supported version and, before a release, the latest one, without signing in. These tests check detection and the protocol handling. They do not sign in to OpenAI or prove that a real, signed-in Codex turn works on your computer. A live run needs your own Codex installation and sign-in, as described in [Install Codex first](#install-codex-first).
