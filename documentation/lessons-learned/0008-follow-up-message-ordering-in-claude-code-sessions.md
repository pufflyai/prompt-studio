# Load history before applying follow-up patches

## 1. When to use

- Changing conversation resume, message indexing, snapshots, or reconnects.

## 2. Failure

- A failed history lookup defaulted the append offset to zero, placing follow-up messages before earlier messages.
- Reconnecting clients also lost history when a fresh delivery log was treated as the conversation.

## 3. Prevention

- Load existing history before starting the resumed harness or deriving append positions.
- Keep conversation state with one owner; persistence and live delivery use that state.
- Acquire the snapshot and subscription together so events cannot fall between them.
- Use the bounded delivery log for transport, not history reconstruction.
- Fix missing history at its source instead of guessing offsets in several layers.

## 4. Evidence

- [Conversation initialization](../../packages/pstdio-api/src/features/sessions/initialize-conversation.ts)
- [Conversation owner](../../packages/pstdio-api/src/features/sessions/session-conversation.ts)
- [Harness spawning](../../packages/pstdio-api/src/features/sessions/spawn-agent.ts)
