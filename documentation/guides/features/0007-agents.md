# Agents

Hand any task to Claude Code, Codex, or OpenCode without leaving your tool, and keep the conversation in your project.

## What agents give you

Prompt Studio has no coding agent of its own. It runs the agents you already use, through harness extensions. A harness starts the agent, sends it your messages, and turns its output into a conversation that Prompt Studio shows and saves.

Prompt Studio ships harnesses for Claude Code, Codex, and OpenCode. Choose the ones you want during project onboarding, or turn them on in **Extensions**. Optional harness extensions add Pi and GitHub Copilot. A harness does not install the agent or sign you in; install the agent and sign in with its own tools.

One conversation with an agent is a session. Prompt Studio starts, queues, and stops sessions, saves the conversation, and shows approval requests. A session that finishes only means the agent stopped. Check the result before you rely on it.

## Use agents in Prompt Studio

Choose **New conversation** on the project's Start page. The conversation opens in a side panel, so the tool you are working in stays visible. Pick an agent and model, type your request, and send it.

- The workspace selector above the message field chooses where the agent works. **Project folder** uses your project's own files.
- When an agent asks before running a tool or changing a file, approve or deny the request in the session.
- When too many sessions run at once, new ones wait as `queued` and start in order. Set the limit in **Settings → Workbench → Runtime → Max concurrent sessions**.

From the terminal, run these inside the project folder:

```sh
pst agents list
pst sessions create --prompt "Summarize this folder" --agent pstdio.harness-claude-code.harness.claude-code
pst sessions follow-up --id <session-id> --prompt "Now add a README"
```

`pst agents list` shows each harness, its full ID, and whether its agent is installed. If an agent is unavailable, the list and the harness menu say why, for example a version that is too old.

Install your tools' skills for an agent with `pst agents setup <agent-id>`, so it knows how to use them. See [Skills](0004-skills.md).

## Use agents from your tool

A tool can start and continue agent work through `ctx.sessions`. `ctx.sessions.create({ title, prompt, workspaceId })` starts a session, `ctx.sessions.followup` sends another message, and `ctx.sessions.query` lists the project's sessions. A hook on `sessionEvents.completed` lets the tool react when the agent finishes. Planner uses the same API to run agent attempts on its tickets.

To connect another agent, write a harness extension and declare it with `defineHarness` in the `harnesses` contribution. The Codex harness source is a complete example.

## Learn more

- [Run agents](../getting-started/0004-run-agents.md) installs an agent and starts a session.
- [Agents and harnesses](../concepts/0003-agents.md) explains what the host and the harness each do.
- [CLI sessions](../../references/cli/0006-sessions.md) lists every session command.
- [Commands and processes](../../references/extensions/0003-command-and-process-api.md#sessions) describes `ctx.sessions`.
- [Codex harness source](../../../extensions/harness-codex/src/harness.ts) shows a full harness.

*Updated at: 2026-11-22*
