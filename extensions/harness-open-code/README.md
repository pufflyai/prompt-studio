# OpenCode

This extension lets Prompt Studio run OpenCode as an agent. You write the prompt in Prompt Studio, and OpenCode does the work in your project with the model provider you set up in OpenCode.

Prompt Studio calls this kind of extension a harness: it starts an agent program, sends it your prompts, and shows the conversation. Prompt Studio installs this extension by default.

## Install and sign in

Prompt Studio installs a private OpenCode CLI with this extension. It uses an existing CLI on the runtime's PATH first, then its private copy. You do not need a global Node.js installation or a separate terminal to set up the private CLI.

1. Enable **OpenCode** in **Settings → Project → Extensions**.
2. Open a chat and choose **Sign in** in the session background, or run `/login`.
3. Choose your provider and sign-in method in the session background. Complete browser sign-in or enter the requested key or code.
4. The session updates when the native CLI confirms sign-in. Choose a model and start chatting.

Cancelling sign-in stops its native worker. The CLI stores its own credentials; Prompt Studio does not copy them into extension settings. Installing the CLI does not sign you in automatically. The session background asks you to sign in and sending stays disabled when the native CLI reports that you are signed out. Use `/logout` to remove stored credentials; OpenCode asks which provider to disconnect. Credentials supplied by the runtime environment must be changed there. OpenCode lets you choose which model provider to connect.

Prompt Studio supports OpenCode 1.0.175 and newer. An older CLI on PATH shows as unavailable with its version and the minimum required version. Update that CLI, or remove it from PATH to use the private installation. Private CLI versions update with the extension.

If you removed the extension, install it again from **Settings → Project → Extensions** or run `pst extensions add harness-open-code`.

## Choose OpenCode

Prompt Studio shares one OpenCode server across projects that use this extension. It reuses a healthy server you started yourself. If Prompt Studio starts the server, disabling the extension in its last active project or shutting down the runtime stops that server. Disabling one project stops its turns while other projects can keep working. Servers started outside Prompt Studio stay running.

Native command definitions are cached for up to 30 seconds per working directory and refreshed after a native command runs. An untouched new conversation does not keep polling command discovery.

- In a new session, open the model menu in the message box, switch the harness to **OpenCode**, and pick a model. Prompt Studio remembers your choice for the next session in the project. A session keeps its agent once it has started.
- To make it the project default, open **Settings → Workbench → Runtime** and choose it under **Default model**.
- Planner actions that start agent work, such as **Run attempt**, let you choose the agent in their form.
- From a terminal, pass its ID to `pst sessions create`:

```sh
pst sessions create --prompt "Review this repository" \
  --agent pstdio.harness-open-code.harness.opencode --model <model>
```

If neither CLI installation can run, OpenCode shows as unavailable in the model menu.

## Models and thinking

The model menu lists the models from `opencode models`. Add or remove providers in OpenCode to change the list.

The **Thinking** option picks the model's thinking level: None, Minimal, Low, Medium, High, XHigh, or Max. The default is Medium. Each model offers only the levels it supports, and models without levels hide the option.

## How it runs

- Prompt Studio talks to a local OpenCode server on `127.0.0.1`. It uses an OpenCode server that already answers on port 4096. Otherwise it starts one with `opencode serve`, and tries the next ports up to 4115 when a port is taken.
- OpenCode works in the session's folder. Prompt Studio does not change OpenCode's permission settings, so your OpenCode configuration decides what it may do without asking.
- When OpenCode asks you a question, the session waits until you answer it in Prompt Studio.
- After Prompt Studio restarts, it can reconnect to an OpenCode session that is still running.
- Before a session starts in a new workspace, Prompt Studio copies the project's skills into `.agents/skills` in that workspace. To add them to the project folder as well, run `pst agents setup pstdio.harness-open-code.harness.opencode`.
