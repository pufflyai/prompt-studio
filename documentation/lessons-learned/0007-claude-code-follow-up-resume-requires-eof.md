# Respect streaming CLI input and completion boundaries

## 1. When to use

- Changing harness input, follow-up, steering, background tasks, or completion.

## 2. Failure

- Leaving stdin open indefinitely prevented a resumed Claude process from finishing. Closing it immediately after sending a prompt would now discard live input or interrupt background work.

## 3. Prevention

- Let one owner coordinate input acknowledgments and EOF.
- In the Claude harness, close stdin after a result arrives with no pending live input or background tasks.
- Drain output pipes, including stderr, to prevent backpressure.
- Respect provider-owned completion. Quiet chat output cannot distinguish a stalled process from reasoning or a long tool call.
- Preserve tests for pending input and background work across result events.

## 4. Evidence

- [Input owner](../../extensions/harness-claude-code/src/session-input.ts)
- [Process lifecycle](../../extensions/harness-claude-code/src/spawn.ts)
- [Stdin tests](../../extensions/harness-claude-code/src/spawn.stdin.p0.test.ts) and [steering tests](../../extensions/harness-claude-code/src/steering.p0.test.ts)
