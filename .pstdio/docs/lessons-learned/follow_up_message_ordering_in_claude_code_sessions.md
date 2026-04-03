# Follow-up Message Ordering in Claude Code Sessions

## What happened

When resuming a Claude Code session with a follow-up, messages were displayed and persisted in the wrong order. Follow-up messages appeared before the original conversation instead of after it.

This was Claude Code-specific. OpenCode uses full-array replacement (`replace /messages`) on every poll cycle so ordering was always correct.

## Why it happened

Two related issues in how offset-based patches interacted with persisted messages:

### 1. `buildMessagesFromPatches` inserted before originals when `messageOffset=0`

Claude Code's `createMessageAccumulator` tracks an `indexOffset` so follow-up patches start after existing messages. When `getMessages()` failed (common for worktree-based sessions), `messageOffset` fell back to 0. The accumulator then emitted patches at `/messages/0`, `/messages/1`, etc.

On persist, `buildMessagesFromPatches` merged these patches with `initialMessages` from the prior session file:

```typescript
// initialMessages = [userA, agentA, agentB]
// patch: { op: "add", path: "/messages/0", value: userB }
messages.splice(0, 0, userB);
// Result: [userB, userA, agentA, agentB] — wrong order
```

`splice(0, 0, msg)` inserted at position 0, pushing originals back.

### 2. Live stream was missing persisted messages

The SSE stream for a resumed session only contained the EventStore's delta patches (the follow-up). The EventStore was created fresh on each resume and didn't contain the original conversation. Clients connecting to the live stream received only follow-up patches without the original messages for context.

## How it was fixed

### `resolveMessagePatchIndexOffset` (session-messages.ts)

Detects when index-based `add` patches overlap with existing `initialMessages` and shifts indices past the end:

```typescript
const resolveMessagePatchIndexOffset = (patches, initialCount) => {
  if (initialCount === 0) return 0;
  const firstIndex = /* first indexed add patch index */;
  if (firstIndex < initialCount) return initialCount; // shift past originals
  return 0;
};
```

### Stream replays persisted messages (stream-session.ts)

`replayActiveSession` sends persisted messages as a `replace /messages` patch before streaming live delta patches. Live patches are also shifted using the same `resolveMessagePatchIndexOffset` so they append correctly.

## Key insight

Claude Code and OpenCode use fundamentally different EventStore patching strategies. Claude Code emits incremental offset-based patches (`add /messages/N`), while OpenCode replaces the full array atomically. Any code that processes patches must account for the offset-based pattern, especially when merging with prior persisted messages. See the "Message patching strategies" section in the agents architecture doc.
