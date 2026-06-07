---
status: "draft"
created: "2026-03-31T12:00:00Z"
---

# Proposal: Attempt Status Hooks

## Problem

`post-session-success` is currently doing work that really belongs to attempt status transitions.

That creates two problems:

1. Hook logic has to reconstruct intent from session completion plus the current `attempt_status`.
2. Side effects like review-session creation can start while the originating session is still active or after the intended status has already been superseded.

The meaningful workflow events are not "the session succeeded". They are transitions such as:

- attempt became `review-ready`
- attempt became `blocked`
- attempt became `reviewed`

What is missing is not a new session event. It is a way to attach hooks to attempt status transitions while delaying side effects until the originating session is over.

## Goals

- Keep workflow automation tied to attempt status transitions.
- Allow blocking validation before a status transition commits.
- Defer post-transition side effects until the originating session ends.
- Deliver only the final post hook for a given session + attempt pair.
- Make deferred delivery durable and idempotent.

## Non-Goals

- Do not remove existing `post-session-*` hooks in this change.
- Do not introduce review-specific commands or hardcoded status names.
- Do not fire post hooks for every intermediate status change in the same session.
- Do not delay the actual attempt status commit until session teardown.

## Proposed Hook Names

Users should think in terms of "hooks for a status", but hook filenames still need a deterministic filesystem-safe form.

Hook files should therefore use a slug derived from the user-defined status name:

- lowercase the name
- replace spaces with `-`
- normalize repeated separators to a single `-`
- trim leading or trailing `-`

Example:

- `My Status` -> `my-status`

Hook lookup is derived from the current status name, not preserved as a stable status-ID binding.

### `pre-attempt-status-<status-slug>`

- Fires before the attempt status changes to the status whose current name resolves to `<status-slug>`.
- Runs immediately.
- Is always blocking.
- Can reject the transition with a non-zero exit code.

### `post-attempt-status-<status-slug>`

- Is queued only when `session_id` is present and the attempt status successfully changes to the status whose current name resolves to `<status-slug>`.
- Runs inline after commit when `session_id` is absent.
- Deferred entries are delivered after the originating session reaches a terminal state.
- Only the most recent queued post hook for the same session + attempt is delivered.

`review-ready` remains a good example because the label already matches the slug. A user-defined status like `My Status` resolves to `my-status`.

## Proposed Rule

> `post-attempt-status-<status-slug>` uses deferred delivery only when the status transition includes `session_id`; in that case it is queued and executed after the originating session reaches a terminal state. Without `session_id`, the post hook executes immediately after commit. If multiple status changes occur for the same attempt in the same session, only the final queued post hook is executed. If that status has since been renamed or no longer exists, the queued hook is skipped.

For this proposal, "session reaches a terminal state" means `completed`, `failed`, or `cancelled`. The session is over; the hook delivery is no longer allowed to overlap with it.

## Lifecycle

When a session asks to change an attempt from `wip` to `review-ready`:

1. Resolve the current attempt status and target status.
2. Run `pre-attempt-status-review-ready`.
3. If the hook exits non-zero, reject the transition and keep the old attempt status.
4. If the hook succeeds, commit the new attempt status immediately.
5. Create a durable `status_change_id`.
6. Record a pending deferred post hook for:
   - `session_id`
   - `attempt_id`
   - `status_change_id`
   - `attempt_status_from`
   - `attempt_status_to`
7. Continue the session normally.
8. When the session ends, deliver the pending post hook for the latest transition recorded by that session for that attempt, but skip it if the status has been renamed or no longer exists.

The status becomes visible to the rest of the system immediately after step 4. Only the expensive side effect waits.

## Example

If one session changes the same attempt like this:

- `running -> review-ready`
- `review-ready -> blocked`

then the session end should deliver only:

- `post-attempt-status-blocked`

and must not deliver:

- `post-attempt-status-review-ready`
- `post-attempt-status-blocked`

This is the last-transition-wins rule. It prevents launching work that is already obsolete by the time the session exits.

## Why This Beats `post-session-success`

`post-session-success` forces automation to infer meaning from terminal session state.

That is backwards for workflows like review:

- validation is about the transition to `review-ready`
- review creation is about the transition to `review-ready`
- ticket movement is about the transition to `reviewed` or `blocked`

Those hooks should remain attached to the status change that expressed the intent. The only special behavior needed is deferred delivery for the post hook.

## Implications of User-Defined Attempt Statuses

Because attempt statuses are user-defined, the platform cannot assume a fixed enum of workflow states. It also cannot use raw labels as-is in the filesystem contract.

### 1. No platform-owned status semantics

- `review-ready`, `blocked`, and `reviewed` are examples, not reserved words.
- Bundled hooks and cookbook examples must stay generic.
- Core behavior must work for any configured status set.

### 2. Names need deterministic slugging

Attempt status names are currently only constrained to "non-empty string". That means names may contain:

- spaces
- mixed case
- punctuation
- characters that are awkward in filenames or shell commands

The proposal should therefore define one slugging rule and use it everywhere hook filenames are derived.

Example:

- `My Status` -> `my-status`
- `Needs   Review` -> `needs-review`
- `Blocked!` -> `blocked`

### 3. Rename breaks the previous hook binding

A queued post hook may be delivered long after the transition committed. If a user renames the status before delivery, the old hook binding should no longer apply.

Proposed rule:

- queue the original resolved slug when the transition commits
- on delivery, resolve the current slug from the current status name
- if the slug changed, skip the queued hook

Status IDs are still useful for audit history, but they do not preserve hook delivery across rename.

Example:

- queued on `My Status` -> `my-status`
- later renamed to `Ready for QA` -> `ready-for-qa`
- queued `post-attempt-status-my-status` does not run

### 4. Missing status means no trigger

If the status definition has been deleted or cannot be resolved anymore at delivery time, the hook should not fire.

Transition records can still keep historical metadata for auditing, but hook delivery is best-effort against the current status definition.

The durable event should keep enough data to explain why the hook was skipped:

- the status IDs
- the status names as they were when the transition happened
- the queued hook slug, stored in `attempt_status_to`

### 5. UI and CLI need to surface the mapping

Because hook filenames are derived from names, the product should show users the exact slug mapping.

Examples:

- status label: `My Status`
- hook slug: `my-status`
- hook files:
  - `pre-attempt-status-my-status`
  - `post-attempt-status-my-status`

Users should not be forced to guess how a display label becomes a hook filename.

## Hook Contract

Attempt status hooks should receive the usual workspace and ticket context plus explicit transition metadata.

### New payload fields

- `attempt_id`
- `attempt_status_from_id`
- `attempt_status_to_id`
- `attempt_status_from`
- `attempt_status_to`
- `status_change_id`
- `session_id`

`attempt_status_from`, `attempt_status_to`, and `attempt_status` should always use the slug form. There is no separate `*_slug` field in the hook contract.

The status IDs are historical metadata, not an instruction to keep triggering the old hook after a rename.

### Existing payload fields to retain

- `project_id`
- `workspace`
- `workspace_id`
- `ticket`
- `branch`
- `worktree_path`
- `attempt_status`

`attempt_status` should equal `attempt_status_to` for consistency with existing hook payloads.

`attempt_id` should be an explicit alias for the current `workspace_id`. The persistence model already treats the workspace record as the attempt record, but the hook surface should expose attempt terminology directly.

### Expected environment variables

- `PSTDIO_ATTEMPT_ID`
- `PSTDIO_ATTEMPT_STATUS_FROM_ID`
- `PSTDIO_ATTEMPT_STATUS_TO_ID`
- `PSTDIO_ATTEMPT_STATUS_FROM`
- `PSTDIO_ATTEMPT_STATUS_TO`
- `PSTDIO_STATUS_CHANGE_ID`
- `PSTDIO_SESSION_ID`

Existing workspace and ticket variables should continue to be present.

## Delivery Model

### Scheduling

- A post hook is scheduled only after the transition is committed.
- Scheduling is keyed by `(session_id, attempt_id)`.
- Scheduling overwrites any earlier pending post hook for that same key.
- Scheduling stores the resolved target `attempt_status_to` slug used for hook lookup.

### Delivery

- Deferred post hooks are delivered when the originating session reaches a terminal state.
- Delivery happens after the session status is persisted.
- Delivery first re-resolves the queued status definition.
- If the status no longer exists, skip the hook.
- If the current slug no longer matches the queued slug, skip the hook.
- Delivery failure must not roll back the already-committed attempt status or session terminal state.

### Idempotency

- `status_change_id` is the delivery identity.
- The system records which `status_change_id` has been delivered.
- Retrying the same delivery must be safe.

## Non-Session Transitions

Not every attempt status change originates from a running session. A user may also change status from the dashboard or CLI outside an active run.

Proposed rule:

- If `session_id` is present, use deferred delivery.
- If `session_id` is absent, run the post hook immediately after commit.

This keeps the model coherent without inventing a fake session boundary for manual operations.

## API and Service Direction

### 1. Centralize the transition path

Attempt status changes should not update the workspace record directly from multiple places.

Introduce one shared transition contract that:

1. loads current attempt status
2. runs the pre hook
3. commits the new status
4. emits the workspace sync event
5. schedules or delivers the post hook

That avoids repeating the session hook mistake where only some status-change paths fired lifecycle automation.

### 2. Extend the attempt status update API

Current shape:

```json
{
  "status": "review-ready"
}
```

Proposed shape:

```json
{
  "status": "review-ready",
  "session_id": "sess_123"
}
```

`session_id` is optional for non-session callers and required for deferred delivery.

The transition service must resolve the full attempt status definition and the derived slug, so it can persist:

- `attempt_status_from_id`
- `attempt_status_to_id`
- `attempt_status_from`
- `attempt_status_to`

For the hook contract, `attempt_status_from` and `attempt_status_to` are already the slug values.

At delivery time, the service should re-resolve `attempt_status_to_id`:

- if it cannot be resolved, skip the hook
- if the current slug differs from `attempt_status_to`, skip the hook

This keeps delivery name-derived:

- rename the status and the old queued hook no longer matches
- delete the status and there is no hook target to deliver

### 3. Define CLI behavior for blocked transitions

When a user or agent calls the CLI to change an attempt status and the corresponding `pre-attempt-status-<slug>` hook exits non-zero:

- the CLI command exits non-zero
- the attempt status remains unchanged
- no `status_change_id` is created
- no deferred post hook is queued
- `stderr` names the blocking hook and surfaces the hook's rejection message when present

Recommended default CLI output:

```text
Attempt status transition blocked by pre-attempt-status-review-ready
from: running
to: review-ready
hook exit code: 1
reason: validation failed
```

For machine-readable mode, `--json` should return a structured error such as:

```json
{
  "error": "attempt_status_transition_blocked",
  "hook": "pre-attempt-status-review-ready",
  "attempt_status_from": "wip",
  "attempt_status_to": "review-ready",
  "exit_code": 1,
  "stderr": "validation failed"
}
```

This gives agents a stable contract:

- non-zero exit means the transition did not happen
- `stderr` or JSON explains which hook blocked it
- no follow-on side effects were scheduled

### 4. Drain deferred hooks on session termination

When session status changes to `completed`, `failed`, or `cancelled`, the shared session termination path should:

1. persist the terminal session status
2. emit sync events
3. fire existing `post-session-*` hooks
4. deliver deferred attempt status post hooks for that session

Startup orphan recovery should also trigger deferred delivery after it resolves a previously-running session to a terminal state. Otherwise a restart could strand queued post hooks forever.

## Recommended Use Cases

### Review-ready

- `pre-attempt-status-review-ready`
  - run validation
  - reject the transition if validation fails
- `post-attempt-status-review-ready`
  - create the review session
  - runs only after the implementation session ends

### Blocked

- `pre-attempt-status-blocked`
  - optional guardrails, for example requiring a reason in the prompt or ticket notes
- `post-attempt-status-blocked`
  - move the ticket to `blocked`

### Reviewed

- `post-attempt-status-reviewed`
  - run `pst tickets update-when-attempt-status`
  - move the ticket only when all attempts are in the desired status

## Data Model Direction

The implementation needs durable state for deferred delivery. The exact schema can vary, but it should preserve these invariants:

- each committed status transition gets a unique `status_change_id`
- pending post delivery can be looked up by `(session_id, attempt_id)`
- pending post delivery stores the resolved `attempt_status_to` slug
- historical transition rows retain status IDs and status names as-of the transition
- delivered state is tracked by `status_change_id`
- a newer transition can supersede an older pending delivery for the same session + attempt

The important distinction is:

- transition history is immutable and keeps the old status facts
- hook delivery is evaluated against the current status definition

One reasonable shape is:

- `attempt_status_changes`
  - immutable transition history
- `pending_attempt_status_posts`
  - one current pending post per session + attempt

This proposal does not require a specific table layout as long as the invariants above hold.

## Test Plan

- pre hook rejects transition and status remains unchanged
- successful transition commits status before session end
- post hook is queued, not executed inline, when `session_id` is present
- second transition in the same session + attempt overwrites the earlier queued post hook
- only the final queued post hook is delivered on session termination
- transitions on different attempts do not overwrite each other
- post hook without `session_id` executes immediately after commit
- retrying delivery for the same `status_change_id` is idempotent
- startup recovery delivers queued post hooks for orphaned sessions once they are resolved to terminal status

## Rollout

1. Add attempt status transition service and hook contract.
2. Extend the workspace attempt-status update API with `originating_session_id`.
3. Add deferred delivery storage and terminal-session drain logic.
4. Move bundled review automation out of `post-session-success` and into attempt status hooks.
5. Update hooks reference and cookbook once the behavior ships.
