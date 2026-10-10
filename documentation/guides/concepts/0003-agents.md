# Agents and harnesses

Prompt Studio has no coding agent of its own. Harness extensions connect it to agents you install, such as Claude Code, Codex, and OpenCode.

## Harnesses

A harness is a contribution from an extension. It knows how to start an agent, send it messages, resume it, and stop it. It turns the agent's output into a conversation that Prompt Studio can show and save.

Each harness has a full ID made of the extension ID and its own ID, such as `pstdio.harness-claude-code.harness.claude-code`. The `pst` command also accepts short names such as `claude-code`.

A harness does not install the agent. Prompt Studio checks whether the agent's command is installed each time it lists harnesses. `pst agents list` shows the result. When a harness cannot use the agent, it says why, for example a missing command or a version that is too old. The harness menu and the **Problem** column of `pst agents list` show that reason. You sign in to the agent with the agent's own tools.

Anyone can write a harness for another agent with the same extension API. Start with [Write an extension](../extensions/0001-authoring.md). The [Codex harness source](../../../extensions/harness-codex/src/harness.ts) is a complete example.

## Sessions

A session is one conversation with an agent in one workspace. The work is split like this:

| Prompt Studio owns | The harness owns |
| --- | --- |
| Starting, queueing, and stopping sessions | Talking to the agent in its own protocol |
| Which workspace the session uses | The agent's own session ID and transcript format |
| Approval requests and your answers | Turning agent output into conversation updates |
| The saved conversation | Reporting when the agent finished, failed, or stopped |

A follow-up continues the same session using the saved conversation and the harness's resume support. The saved conversation is Prompt Studio's record of the session.

Queued work survives a runtime restart. Already-running work reconnects only when the harness supports reattachment. Otherwise, the session becomes `disconnected`; send a follow-up to resume it if the agent's session is still available. A restart does not guarantee that an interrupted task finishes.

A session finishing only means the agent stopped. It does not prove that the work is correct. Tools such as Planner add their own review steps for that.

## Where the agent runs

A local agent runs as a process on your computer, in the workspace folder. A remote-capable harness can run the agent on another machine through a remote workspace. Prompt Studio never falls back to a local folder for a remote workspace. See [Local and remote work](0004-local-and-remote.md).

## Skills

Extensions can ship skills: instruction files that teach an agent how to use a tool. `pst agents setup <agent-id>` copies the skills of your enabled extensions to the place where that agent reads them. Prompt Studio does not overwrite a skill you already have with the same name.

## Learn more

- [Run agents](../getting-started/0004-run-agents.md)
- [CLI agents](../../references/cli/0002-agents.md)
- [CLI sessions](../../references/cli/0006-sessions.md)
