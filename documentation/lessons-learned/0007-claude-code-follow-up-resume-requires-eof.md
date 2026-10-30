# Claude Code Follow-up Resume Requires EOF

## What happened

Claude Code follow-up sessions could stay in `in_progress` indefinitely after the user submitted a follow-up prompt.

The dashboard showed the session as still working, and the follow-up never reached a terminal status even though the prompt had already been sent.

## Why it happened

Two behaviors combined:

### 1. Claude resume was waiting for end-of-input

Our Claude Code resume path starts a fresh `claude --resume ... --input-format stream-json` process, writes one follow-up user message to `stdin`, and then waits for streamed output.

In the buggy path, the follow-up write kept `stdin` open. In practice, Claude's resume flow could interpret that as "more input may still arrive" and wait instead of finalizing the turn.

This only affected the resume path. Initial Claude session starts already closed `stdin` after the first prompt.

### 2. Session completion depended on child-process exit

`pst` transitions an active session to `completed` or `failed` when the spawned agent process exits.

Once Claude stopped making progress while still waiting on open `stdin`, the child process never exited, so the session lifecycle never advanced past `in_progress`.

## How it was fixed

### Close `stdin` after sending the follow-up prompt

The Claude resume wrapper now treats a follow-up as a one-shot input payload and closes `stdin` immediately after writing the message. That gives Claude the EOF it needs to finalize the resumed turn.

### Let the provider control completion

The original host timeout was superseded by PS-389. Claude Code and Codex now use provider-owned completion. A lack of chat events cannot distinguish a hung process from quiet reasoning or a long tool call, so the host activity watchdog must not terminate these CLI sessions.

The [Claude Code harness](../../extensions/harness-claude-code/src/spawn.ts) now keeps stdin open until a result arrives with no pending live input or background tasks. This lets corrections reach the running process and lets background tasks finish before EOF. It drains stderr to prevent output backpressure and returns `timeoutStrategy: "provider"`. The [stdin tests](../../extensions/harness-claude-code/src/spawn.stdin.p0.test.ts) and [steering tests](../../extensions/harness-claude-code/src/steering.p0.test.ts) cover that boundary.

## Key takeaway

When wrapping a streaming CLI, writing the message is not enough. The input boundary is part of the protocol.

If the provider expects EOF to conclude a run, leaving `stdin` open forever can look like unfinished work. Closing it too early can discard pending input or background tasks. Close the input boundary when the provider's work is finished, drain output pipes, and respect its completion contract.
