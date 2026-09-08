# Temporary PocketCoder turn cursor

## Intended design

PocketCoder should accept an idempotent turn ID and expose its acceptance and completion state. Prompt Studio could then reconnect to that exact turn after a lost response or host restart.

## External limit

PocketCoder's AgentAPI relay accepts `POST /agent/message` without a caller-supplied turn ID or idempotency key. It exposes a workspace conversation and agent status. These identify a conversation, but cannot distinguish a new, unaccepted follow-up from the previous completed turn after a restart.

## Temporary workaround

The `remove-workspaces` harness saves the highest existing AgentAPI message ID before submitting each turn. It stores that non-secret cursor in public harness state, keyed by the host session ID and bound to the PocketCoder workspace ID. Reattachment uses the saved cursor and waits for an assistant message beyond it. It never resends a prompt automatically.

The harness owns this cursor. A new turn replaces it. A completed or canceled turn removes it. A disconnected turn retains it for recovery; a later follow-up replaces it. An abandoned disconnected session leaves a small record until the host's harness state is removed. The record contains no transcript or credentials.

This cannot prove whether an unacknowledged prompt was accepted. If PocketCoder remains stable without any new reply, the harness waits until the workspace ends or the user stops it. That is preferable to executing a potentially destructive prompt twice. The README tells callers to inspect the conversation before manually repeating a prompt with an unknown outcome.

## Isolation and removal

The cursor stays inside the PocketCoder extension and uses the existing public harness-state API. Core workspace and session schemas do not change. Remove the cursor when PocketCoder exposes idempotent turn submission and turn lookup, and use its remote turn reference for recovery instead.
