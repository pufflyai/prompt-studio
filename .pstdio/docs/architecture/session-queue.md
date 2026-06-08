# Session Queue

Prompt Studio limits agent runtime concurrency by routing session starts and follow-ups through a scheduler. The queue is persisted so accepted work survives API restarts and can resume when capacity becomes available.

## Why This Exists

Before the queue, every create or follow-up request attempted to start an agent
immediately. That made the system easy to overload and made planner ticket
attempt creation sensitive to workspace setup timing. The queue separates
accepting user work from starting agent processes.

## Product Contract

1. A user can submit a new session or follow-up even when all concurrency slots are full.
2. Accepted work returns a session with status `queued`.
3. Queued work preserves the submitted prompt in persisted session history.
4. Queued sessions are visible in the dashboard and cannot be stopped as running processes.
5. When capacity opens, queued sessions start automatically in FIFO order.
6. If concurrency is unlimited, session starts continue immediately.

## Architecture

```
create / follow-up / planner ticket attempt
        │
        ▼
 session scheduler
        │
        ├── capacity available ──► start or resume agent runtime
        │
        └── at capacity ─────────► sessions.status = queued
                                  session_queue_entries row
                                  persisted prompt payload

agent exits / settings change / startup recovery
        │
        ▼
 scheduler drain
        │
        ▼
 claim next queued session
        │
        ▼
 start or resume agent runtime
```

## Capacity Model

The global runtime setting `max_concurrent_sessions` controls how many sessions may actively occupy runtime capacity.

Active capacity includes:

- `in_progress`
- `awaiting_input`

Queued capacity does not include:

- `queued`
- `completed`
- `failed`
- `cancelled`
- `disconnected`

`null` means unlimited concurrency. A positive integer means the scheduler only starts more work when active sessions are below that limit.

## Queue Ownership

Queued sessions are scheduler-owned. A queued session must have a matching `session_queue_entries` row containing the prompt, request kind, optional question response payload, and dispatch claim metadata.

The queue entry is the durable intent to run the session. The session row is the durable UI and lifecycle record.

## Dispatch Safety

Queue claiming is intentionally two phase:

1. The scheduler claims a queued session by moving the session to `in_progress` and setting `dispatch_started_at` on the queue entry.
2. The scheduler starts or resumes the agent runtime.
3. After the runtime dispatch boundary is crossed, the scheduler removes the queue entry.

This avoids losing accepted work if the API crashes after claiming but before dispatching. On startup, claimed entries without an in-memory runtime are reset to `queued` and drained again.

## Startup Ordering

Queue recovery must run before orphaned `in_progress` recovery. Otherwise, a claimed-but-not-dispatched queued session can be mistaken for a stale running session and marked `disconnected`.

Startup order:

1. Recover queued sessions and reset stale dispatch claims.
2. Drain queued sessions while capacity is available.
3. Resolve unrelated orphaned `in_progress` sessions.

## Follow-Ups

Follow-up requests use the same scheduler path as new sessions.

When a follow-up is accepted but queued:

1. The session status becomes `queued`.
2. The follow-up prompt is persisted in the queue entry.
3. Conversation hydration includes the queued user prompt before the queued status banner.
4. The dashboard keeps an optimistic copy of the prompt until hydrated conversation history replaces it.

Question responses for `awaiting_input` sessions bypass capacity checks. They resume work that already occupies active capacity, so queueing them would deadlock the approval flow.

## Planner Ticket Attempts

Planner ticket attempt sessions are not created until workspace setup succeeds.
Worktree setup and pre-worktree hooks run before the scheduler can accept the
session. If setup fails, the host workspace records `setup_error` and no queued
session is created.

This keeps planner ticket attempt state consistent: a failed workspace setup
cannot leave behind a queued agent run for a workspace that is not ready.

## Dashboard Responsibilities

The dashboard treats `queued` as an accepted-but-not-running state:

- Session badges show queued status.
- The chat shows the queued prompt and a queued-session banner.
- Runtime controls that require a process handle are disabled.
- Queued follow-ups trigger hydration/reconnect so the persisted queued prompt replaces optimistic state.

## Rules

1. All session starts and follow-ups must go through the scheduler.
2. Queued sessions must always have durable queue entries.
3. Do not delete a queue entry before the runtime dispatch boundary is crossed.
4. Startup recovery must reset stale dispatch claims before orphan recovery.
5. Question responses must not be queued behind their own active session capacity.
6. Dashboard chat must preserve queued prompts until persisted history replaces optimistic state.
