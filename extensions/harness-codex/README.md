# Codex

This extension lets Prompt Studio run OpenAI's Codex as an agent. You write the prompt in Prompt Studio, and Codex does the work in your project.

Prompt Studio calls this kind of extension a harness: it starts an agent program, sends it your prompts, and shows the conversation. Prompt Studio installs this extension by default.

## Install and sign in

Prompt Studio installs a private Codex CLI with this extension. It uses an existing CLI on the runtime's PATH first, then its private copy. You do not need a global Node.js installation or a separate terminal to set up the private CLI.

1. Enable **Codex** in **Settings → Project → Extensions**.
2. Open a chat and choose **Sign in** in the session background, or run `/login`.
3. Choose ChatGPT or API key. For ChatGPT, Prompt Studio opens the sign-in page in your browser; enter the one-time code shown in the session background.
4. The session updates when Codex confirms sign-in. Choose a model and start chatting.

Codex uses its native app-server device-code flow, so this works when the runtime is in Docker or on another machine without a localhost callback or terminal modal. If a browser blocks the new tab, choose **Open sign-in page**. **Cancel** stops the pending native login. Device-code login must be allowed in your ChatGPT security settings or workspace permissions; see [Codex authentication](https://learn.chatgpt.com/docs/auth).

The CLI stores its own credentials; Prompt Studio does not copy them into extension settings. Installing the CLI does not sign you in automatically. The session background asks you to sign in and sending stays disabled when the native CLI reports that you are signed out. `/logout` removes stored credentials in the background. Credentials supplied by the runtime environment must be changed there.

Prompt Studio supports Codex 0.157.0 and newer. An older CLI on PATH shows as unavailable with its version and the minimum required version. Update that CLI, or remove it from PATH to use the private installation. Private CLI versions update with the extension.

If you removed the extension, install it again from **Settings → Project → Extensions** or run `pst extensions add harness-codex`.

## Choose Codex

- In a new session, open the model menu in the message box, switch the harness to **Codex**, and pick a model. Prompt Studio remembers your choice for the next session in the project. A session keeps its agent once it has started.
- To make it the project default, open **Settings → Workbench → Runtime** and choose it under **Default model**.
- Planner actions that start agent work, such as **Run attempt**, let you choose the agent in their form.
- From a terminal, pass its ID to `pst sessions create`:

```sh
pst sessions create --prompt "Review this repository" \
  --agent pstdio.harness-codex.harness.codex --model <model>
```

If neither CLI installation can run, Codex shows as unavailable in the model menu.

## Models, speed and reasoning effort

Prompt Studio asks Codex for its list of models, so the menu shows what your Codex account can use.

The **Speed** option offers Standard and Fast. Fast uses the native Codex service tier, like `/fast` in the Codex CLI, and uses more of your Codex allowance. Availability depends on your model and account. See [Codex speed](https://learn.chatgpt.com/docs/agent-configuration/speed).

Choose a speed before sending a prompt. It applies to that turn and later turns in the session; choosing Standard switches Fast off. It also applies when starting or resuming a goal and when compacting a conversation. Prompt Studio resolves an omitted selection to Standard. Programmatic callers can set the harness parameter `service_tier` to `fast` or `default` (Standard). Direct harness callers that omit this parameter keep the native Codex setting.

The **Reasoning effort** option sets how much Codex thinks before it answers: Minimal, Low, Medium, High, or XHigh. The default is Medium. Each model can offer fewer levels or its own default, and models without the option hide it.

## How it runs

- Prompt Studio starts the selected Codex executable's `app-server` on the computer that runs Prompt Studio and talks to it over standard input and output. Sessions that use the same executable and environment share one app-server process. Each Prompt Studio session has its own Codex thread.
- Open session tabs keep their native resources, including inactive tabs. After the last tab closes, Prompt Studio keeps the session ready for 30 minutes after its last use, then releases its idle thread and tool servers. Active runs, native questions, goals, controls, and uncertain native execution stay alive. A later message resumes the saved thread and conversation. A saved async question can still be answered after its completed turn's resources are released. The app-server closes after its last thread or history reader releases it.
- Each thread starts in the session's folder with approvals turned off and full file access (`approvalPolicy: "never"`, `sandbox: "danger-full-access"`). Codex can edit files and run commands there without asking first. Use a separate workspace, such as a Git worktree, when you want to keep your project folder unchanged.
- Prompt Studio saves the conversation itself. When it needs Codex's own record, for example after a restart or before it continues an interrupted turn, it asks the app-server with `thread/read`. It does not read Codex's session files directly.
- When Prompt Studio prepares a workspace, it copies the project's enabled skills into `.agents/skills` there. These are copies; edit a skill in the extension that ships it. To install them with the CLI, run `pst agents setup pstdio.harness-codex.harness.codex`. See [Give the agent skills](../../documentation/guides/getting-started/0004-run-agents.md#give-the-agent-skills) for how existing skill files are kept or replaced in each release.
- Commands that Codex runs get `PSTDIO_SESSION_ID` and `PSTDIO_PROJECT_ID` in their environment. When the agent runs `pst` commands, they act for that session and project.

OpenAI labels the Codex app-server as experimental. [ADR 0064](../../documentation/adrs/0064-codex-app-server-runtime.md) explains why Prompt Studio uses it, and how threads, history, and stopping work.

## What is tested

The harness tests replay recorded app-server traffic from Codex 0.157.0 and 0.162.0, and use local test servers for threads, history, questions, goals, and cleanup. Tests also check private executable discovery, PATH precedence, and the sign-in request without global PATH tools. CI also starts the installed Codex CLI, at the minimum supported version and, before a release, the latest one, without signing in. These tests check detection, protocol handling, real MCP child cleanup, and resuming a saved thread with a paused goal. They do not sign in to OpenAI or prove that a real, signed-in Codex turn works on your computer. A live run needs an available Codex CLI and sign-in, as described in [Install and sign in](#install-and-sign-in).
