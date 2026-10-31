# Claude Code

This extension lets Prompt Studio run Anthropic's Claude Code as an agent. You write the prompt in Prompt Studio, and Claude Code does the work in your project.

Prompt Studio calls this kind of extension a harness: it starts an agent program, sends it your prompts, and shows the conversation. Prompt Studio installs this extension by default.

## Install and sign in

Prompt Studio installs a private Claude Code CLI with this extension. It uses an existing CLI on the runtime's PATH first, then its private copy. You do not need a global Node.js installation or a separate terminal to set up the private CLI.

1. Enable **Claude Code** in **Settings → Project → Extensions**.
2. Open a chat and choose **Sign in** in the session background, or run `/login`.
3. Choose your provider and sign-in method in the session background. Complete browser sign-in or enter the requested key or code.
4. The session updates when the native CLI confirms sign-in. Choose a model and start chatting.

Cancelling sign-in stops its native worker. The CLI stores its own credentials; Prompt Studio does not copy them into extension settings. Installing the CLI does not sign you in automatically. The session background asks you to sign in and sending stays disabled when the native CLI reports that you are signed out. Use `/logout` to remove stored credentials. Credentials supplied by the runtime environment must be changed there.

Prompt Studio supports Claude Code 2.1.203 and newer. An older CLI on PATH shows as unavailable with its version and the minimum required version. Update that CLI, or remove it from PATH to use the private installation. Private CLI versions update with the extension.

If you removed the extension, install it again from **Settings → Project → Extensions** or run `pst extensions add harness-claude-code`.

## Choose Claude Code

- In a new session, open the model menu in the message box, switch the harness to **Claude Code**, and pick a model. Prompt Studio remembers your choice for the next session in the project. A session keeps its agent once it has started.
- To make it the project default, open **Settings → Workbench → Runtime** and choose it under **Default model**.
- Planner actions that start agent work, such as **Run attempt**, let you choose the agent in their form.
- From a terminal, pass its ID to `pst sessions create`:

```sh
pst sessions create --prompt "Review this repository" \
  --agent pstdio.harness-claude-code.harness.claude-code --model <model>
```

If neither CLI installation can run, Claude Code shows as unavailable in the model menu.

## Models and thinking

Prompt Studio asks Claude Code for its list of models, so the menu shows what your Claude Code account can use. The default model appears as **Opus**.

The **Thinking** option sets how much effort Claude Code spends before it answers: Low, Medium, High, XHigh, or Max. The default is High. Models that do not support it hide the option, and some models offer fewer levels.

## How it runs

- Prompt Studio starts `claude` in the session's folder with permission prompts turned off. Claude Code can edit files and run commands there without asking first. Use a separate workspace, such as a Git worktree, when you want to keep your project folder unchanged.
- Before a session starts in a new workspace, Prompt Studio copies the project's skills into `.claude/skills` in that workspace. To add them to the project folder as well, run `pst agents setup pstdio.harness-claude-code.harness.claude-code`.
- Prompt Studio reads the conversation history from Claude Code's own files in `~/.claude/projects`.
- The session's environment contains `PSTDIO_SESSION_ID` and `PSTDIO_PROJECT_ID`. When the agent runs `pst` commands, they act for that session and project.

## Correct active work

Use the conversation's steering controls to send a correction while Claude works. You can send new input or send a saved queued message now. From a terminal, use `pst sessions follow-up --id <session> --prompt "Use this correction" --steer`.

Claude receives the correction at its next supported input boundary, usually after the current tool finishes. The same process and native session continue with the current model and settings. Attachments follow the same rules as ordinary prompts.

Prompt Studio confirms delivery after Claude acknowledges the message. Each submission appears once in the conversation, including identical messages, and keeps its identity when history is reopened. Claude saves corrections received during a tool as queued-command entries; the harness reads those as user messages.

If the run has already stopped accepting input, delivery is rejected. If the connection fails after a possible send, delivery remains uncertain and is never resent automatically. A run completes after its pending input and background work finish.
