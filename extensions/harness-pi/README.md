# Pi

Run the Pi coding agent from Prompt Studio. Install this optional extension to use Pi in the existing session and model controls.

## Install and sign in

Prompt Studio installs a private, pinned Pi CLI with this optional extension, using its Bun installer. An existing CLI on the runtime's PATH takes precedence. The private CLI runs with Prompt Studio's bundled Bun; no global Node installation or terminal setup is needed. Pi 0.73.1 or newer is required.

Open a chat and choose **Sign in** in the session background, or use `/login`. Choose a provider and its browser or API-key method. Browser links, native provider choices, and masked code/key input stay in the chat. Complete browser sign-in and the session refreshes without restarting Prompt Studio. Use `/logout` to remove a stored account.

Pi owns credentials in its native agent directory, including when `PI_CODING_AGENT_DIR` changes it. Environment credentials and keys or commands in Pi's model configuration stay managed there. Readiness follows the selected model provider. Native extensions can register additional OAuth providers and selection prompts. Account actions run in a separate worker; cancelling or disabling the harness stops that worker and its callback listener without stopping other sessions. Replies stay outside conversation history and extension command events.

Install **Pi** from **Settings → Project → Extensions**, or run:

```sh
pst extensions add harness-pi
pst agents setup pstdio.harness-pi.harness.pi
```

The extension is optional and is not installed by default. Choose **Pi** in a new session's model menu, or start a session from the terminal:

```sh
pst sessions create --prompt "Review this project" \
  --agent pstdio.harness-pi.harness.pi
```

## Sessions

Pi runs in the session's workspace. Text, reasoning, tool results and token usage stream into the conversation. File attachments are passed to Pi with its native file input support. The Thinking option is hidden for models that do not support reasoning.

Continuing a conversation resumes the same native Pi session. History stays in Pi's own session store, including when `PI_CODING_AGENT_DIR` selects another agent directory. Stopping a turn or disabling the extension terminates its running Pi processes. A host restart cannot reconnect to a running process; saved conversations can be resumed.

Pi runs its configured tools with the access granted to the Pi process. This harness does not provide tool approval dialogs, interactive Pi extension dialogs, live steering, native slash commands beyond the host account commands, or session forking. Configure Pi itself for the tools and resources you want it to load.

Project skills are copied to `.pi/skills` before workspace sessions start. `pst agents setup` installs them into the current project too.

See [Pi's documentation](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) for provider setup, models, skills and tools.
