# Claude Code

This extension lets Prompt Studio run Anthropic's Claude Code as an agent. You write the prompt in Prompt Studio, and Claude Code does the work in your project.

Prompt Studio calls this kind of extension a harness: it starts an agent program, sends it your prompts, and shows the conversation. Prompt Studio installs this extension by default.

## Install Claude Code first

Prompt Studio does not include Claude Code. Install it on the computer that runs Prompt Studio, so that the `claude` command works in a terminal:

```sh
curl -fsSL https://claude.ai/install.sh | bash
claude --version
```

Prompt Studio supports Claude Code 2.1.203 and newer. An older version shows as not installed. Update it with `claude update`.

Start `claude` once in a terminal and sign in. Prompt Studio uses that sign-in and never asks for your Anthropic credentials.

Check that Prompt Studio finds Claude Code:

```sh
pst agents list
```

The Claude Code row should say `yes` under **Installed**. Prompt Studio checks this by running `claude --version`.

If you removed the extension, install it again from **Settings → Project → Extensions**, or with `pst extensions add harness-claude-code`.

## Choose Claude Code

- In a new session, open the model menu in the message box, switch the harness to **Claude Code**, and pick a model. Prompt Studio remembers your choice for the next session in the project. A session keeps its agent once it has started.
- To make it the project default, open **Settings → Workbench → Runtime** and choose it under **Default model**.
- Planner actions that start agent work, such as **Run attempt**, let you choose the agent in their form.
- From a terminal, pass its ID to `pst sessions create`:

```sh
pst sessions create --prompt "Review this repository" \
  --agent pstdio.harness-claude-code.harness.claude-code --model <model>
```

If the `claude` command is missing, Claude Code shows as unavailable in the model menu.

## Models and thinking

Prompt Studio asks Claude Code for its list of models, so the menu shows what your Claude Code account can use. The default model appears as **Opus**.

The **Thinking** option sets how much effort Claude Code spends before it answers: Low, Medium, High, XHigh, or Max. The default is High. Models that do not support it hide the option, and some models offer fewer levels.

## How it runs

- Prompt Studio starts `claude` in the session's folder with permission prompts turned off. Claude Code can edit files and run commands there without asking first. Use a separate workspace, such as a Git worktree, when you want to keep your project folder unchanged.
- Before a session starts in a new workspace, Prompt Studio copies the project's skills into `.claude/skills` in that workspace. To add them to the project folder as well, run `pst agents setup pstdio.harness-claude-code.harness.claude-code`.
- Prompt Studio reads the conversation history from Claude Code's own files in `~/.claude/projects`.
- The session's environment contains `PSTDIO_SESSION_ID` and `PSTDIO_PROJECT_ID`. When the agent runs `pst` commands, they act for that session and project.
