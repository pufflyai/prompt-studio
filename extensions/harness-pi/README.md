# Pi

Run the Pi coding agent from Prompt Studio. Install this optional extension to use Pi in the existing session and model controls.

## Install

Install Pi on the computer running Prompt Studio:

```sh
bun add --global @mariozechner/pi-coding-agent
pi --version
```

Pi 0.73.1 or newer is required. Run `pi` and use `/login`, or configure a provider API key in Pi. Prompt Studio uses Pi's configured models and credentials.

Install **Pi** from **Settings → Project → Extensions**, or run:

```sh
pst extensions add harness-pi
pst agents setup pstdio.harness-pi.harness.pi
```

The extension is optional and is not installed by default. Choose **Pi** in a new session's model menu, or start a session from the terminal:

```sh
pst sessions create --prompt "Review this project" \
  --agent pstdio.harness-pi.harness.pi --model <provider/model>
```

## Sessions

Pi runs in the session's workspace. Text, reasoning, tool results and token usage stream into the conversation. File attachments are passed to Pi with its native file input support. The Thinking option is hidden for models that do not support reasoning.

Continuing a conversation resumes the same native Pi session. History stays in Pi's own session store, including when `PI_CODING_AGENT_DIR` selects another agent directory. Stopping a turn or disabling the extension terminates its running Pi processes. A host restart cannot reconnect to a running process; saved conversations can be resumed.

Pi runs its configured tools with the access granted to the Pi process. This harness does not provide tool approval dialogs, interactive Pi extension dialogs, live steering, native slash commands, or session forking. Configure Pi itself for the tools and resources you want it to load.

Project skills are copied to `.pi/skills` before workspace sessions start. `pst agents setup` installs them into the current project too.

See [Pi's documentation](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) for provider setup, models, skills and tools.
