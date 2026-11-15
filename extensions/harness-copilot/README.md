# GitHub Copilot

Run the GitHub Copilot coding agent from Prompt Studio. Install this optional extension to use Copilot in the existing session and model controls.

## Install and sign in

The extension ships the Copilot runtime through the pinned `@github/copilot-sdk` package. Installation downloads only your platform's runtime package. No global Copilot CLI or Node installation is needed.

Copilot uses your GitHub CLI login. Run `gh auth login` in a terminal, or choose **Sign in → GitHub token** in a chat and paste a token with Copilot access. The token stays in Copilot's own credential store. Sign out with `gh auth logout` or Copilot's `/logout`.

Install **GitHub Copilot** from **Settings → Project → Extensions**, or run:

```sh
pst extensions add harness-copilot
pst agents setup pstdio.harness-copilot.harness.copilot
```

Choose **GitHub Copilot** in a new session's model menu, or start a session from the terminal:

```sh
pst sessions create --prompt "Review this project" \
  --agent pstdio.harness-copilot.harness.copilot
```

## Sessions

Each turn starts a short-lived Copilot runtime in the session's workspace and stops it when the turn ends. Copilot keeps the session in its own store (`~/.copilot`, or `COPILOT_HOME`), so continuing a conversation resumes the same native session. Text, reasoning, tool calls and token usage stream into the conversation. Attached files go to Copilot as file attachments.

Copilot loads the project's own configuration, as the Copilot CLI does: custom instructions, skills, agents and MCP servers.

Messages you send while Copilot is working join the running turn. Forking a conversation copies Copilot's session up to the chosen message.

**Permission mode** defaults to **Allow all**, which matches the other harnesses. **Ask** sends each Copilot permission prompt to the session's approval dialog. Copilot's `ask_user` questions appear in the question form.

**Reasoning** lists the effort levels each model supports. **Default** leaves the choice to Copilot.

Project skills are copied to `.github/skills` before workspace sessions start. `pst agents setup` installs them into the current project too. Personal skills live in `~/.copilot/skills`.

Token usage shows while a turn streams. Reloaded conversations do not include it, because Copilot does not save per-call usage.

A host restart ends a running turn, as with Codex: the Copilot runtime stops with the host, the interrupted tool call shows as failed, and the session shows as disconnected. Continue the conversation to resume the same Copilot session.

## Account quotas

`pst harness-copilot quotas` reports premium-request quotas for plans billed by request.

Plans billed by tokens have no limit Copilot can report, so the command returns `unsupported` with this month's token use instead. The `usage` field lists input, output, cache and reasoning tokens since the 1st of the month (UTC), in total and per model. It counts sessions saved on this device, including sessions started outside Prompt Studio. Check the remaining budget at github.com/settings/billing.

*Updated at: 2026-11-15*
