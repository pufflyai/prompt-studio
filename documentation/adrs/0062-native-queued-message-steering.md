# Native queued-message steering

Proposed: 2026-10-08

Status: Accepted for the host contract. Provider adoption remains gated by live validation and SDK publication.

## Decision

The host owns queue selection, request settings, delivery coordination, and persistence. A harness may expose an optional `steer` method on its active handle. It accepts input into current work without starting or cancelling a run. Older harnesses remain usable without that method.

Each queued request stores its model and complete resolved parameters. Its revision changes whenever it is edited, reordered, or combined. Queue position identifies a slot; revision identifies its current saved request. A revision must distinguish identical prompts and edits in the same millisecond.

The host saves a steering delivery identity and captured run identity before provider I/O. This is delivery data, not a second conversation or visual state. The queue service owns the intent. While it exists, dispatch, editing, combining, removal, and repeated steering cannot replay or change the request. A definite provider rejection releases the intent. Acceptance removes the queue entry only after a matching user message is persisted. Uncertain delivery retains the original request and intent across restart.

The provider must emit and retain the host delivery identity in normalized history. Positive history evidence can complete an interrupted handoff. Missing evidence does not prove rejection and never permits automatic replay. The UI exposes uncertainty and retained content rather than a retry action.

## Alternatives

Stopping and resuming changes the meaning of steering. Displaying a user bubble without provider acceptance changes only the screen. Treating a steering intent as a normal dispatch claim would replay uncertain input after restart. None satisfies the delivery contract.

## Validation and release

Codex 0.160.0 accepted `turn/steer` during a command, consumed the correction, continued the original work, and rejected input after completion. A second probe verified that `clientUserMessageId` survives `thread/read` as the steered user message’s `clientId`, with one matching native user item.

Claude Code 2.1.294 live validation is blocked by the account's weekly usage limit. OpenCode support remains unverified. Neither is enabled by assumption. Publish the additive SDK contract before adopting it in a separate harness release, as required by the extension workflow.
