# Load conversation history before applying follow-up patches

## What went wrong

Claude Code follow-up messages appeared before the original conversation. The harness emitted indexed patches, but a failed history lookup made the message offset fall back to zero. Merging an `add /messages/0` patch with existing messages inserted the follow-up at the beginning.

The live stream had a related problem: its fresh event store contained only follow-up patches, so reconnecting clients could miss the earlier conversation.

## Why

The implementation mixed three different things: persisted conversation history, a delivery log of patches, and the provider's patch indexing. A delivery log for one turn was treated as enough information to reconstruct the full conversation.

## Current contract

The original patch-index shifting helpers have been replaced by a conversation owner:

1. [Conversation initialization](../../../packages/pstdio-api/src/features/sessions/initialize-conversation.ts) loads history before the resumed harness starts.
2. [Session spawning](../../../packages/pstdio-api/src/features/sessions/spawn-agent.ts) passes the loaded conversation's message count as `messageOffset`.
3. The [conversation owner](../../../packages/pstdio-api/src/features/sessions/session-conversation.ts) applies patches to the same message state used for snapshots. Its bounded delivery log is not used to reconstruct history.
4. Snapshot and subscription are acquired together so clients receive a consistent starting conversation and subsequent events.

## Key takeaway

Load the existing conversation before deriving append positions. Keep conversation state with one owner, and make persistence and live delivery use that state. Do not compensate for missing history by guessing patch offsets in several layers.
