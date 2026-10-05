# OpenCode

This extension lets Prompt Studio run OpenCode as an agent. You write the prompt in Prompt Studio, and OpenCode does the work in your project with the model provider you set up in OpenCode.

Prompt Studio calls this kind of extension a harness: it starts an agent program, sends it your prompts, and shows the conversation. Prompt Studio installs this extension by default.

## Install OpenCode first

Prompt Studio does not include OpenCode. Install it on the computer that runs Prompt Studio, so that the `opencode` command works in a terminal:

```sh
bun add --global opencode-ai
opencode --version
```

Set up at least one model provider in OpenCode, for example with `opencode auth login`. Prompt Studio offers the models that `opencode models` lists, and never asks for your provider credentials.

Check that Prompt Studio finds OpenCode:

```sh
pst agents list
```

The OpenCode row should say `yes` under **Installed**. Prompt Studio checks this by running `opencode --version`.

If you removed the extension, install it again from **Settings → Project → Extensions**, or with `pst extensions add harness-open-code`.

## Choose OpenCode

- In a new session, open the model menu in the message box, switch the harness to **OpenCode**, and pick a model. Prompt Studio remembers your choice for the next session in the project. A session keeps its agent once it has started.
- To make it the project default, open **Settings → Workbench → Runtime** and choose it under **Default model**.
- Planner actions that start agent work, such as **Run attempt**, let you choose the agent in their form.
- From a terminal, pass its ID to `pst sessions create`:

```sh
pst sessions create --prompt "Review this repository" \
  --agent pstdio.harness-open-code.harness.opencode --model <model>
```

If the `opencode` command is missing, OpenCode shows as unavailable in the model menu.

## Models and thinking

The model menu lists the models from `opencode models`. Add or remove providers in OpenCode to change the list.

The **Thinking** option picks the model's thinking level: None, Minimal, Low, Medium, High, XHigh, or Max. The default is Medium. Each model offers only the levels it supports, and models without levels hide the option.

## How it runs

- Prompt Studio talks to a local OpenCode server on `127.0.0.1`. It uses an OpenCode server that already answers on port 4096. Otherwise it starts one with `opencode serve`, and tries the next ports up to 4115 when a port is taken.
- OpenCode works in the session's folder. Prompt Studio does not change OpenCode's permission settings, so your OpenCode configuration decides what it may do without asking.
- When OpenCode asks you a question, the session waits until you answer it in Prompt Studio.
- After Prompt Studio restarts, it can reconnect to an OpenCode session that is still running.
- Before a session starts in a new workspace, Prompt Studio copies the project's skills into `.agents/skills` in that workspace. To add them to the project folder as well, run `pst agents setup pstdio.harness-open-code.harness.opencode`.
