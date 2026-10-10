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

If you removed the extension, install it again from **Settings → Project → Extensions**, or with `pst extensions add harness-codex`.

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

- Prompt Studio runs `codex exec` in the session's folder with approvals and the Codex sandbox turned off. Codex can edit files and run commands there without asking first. Use a separate workspace, such as a Git worktree, when you want to keep your project folder unchanged.
- Before a session starts in a new workspace, Prompt Studio copies the project's skills into `.agents/skills` in that workspace. To add them to the project folder as well, run `pst agents setup pstdio.harness-codex.harness.codex`.
- Prompt Studio reads the conversation history from Codex's own session files in `~/.codex/sessions`, or in `$CODEX_HOME/sessions` when `CODEX_HOME` is set.
- The session's environment contains `PSTDIO_SESSION_ID` and `PSTDIO_PROJECT_ID`. When the agent runs `pst` commands, they act for that session and project.
