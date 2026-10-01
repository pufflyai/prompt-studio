# Temporary Codex question delivery confirmation

Proposed: 2026-10-01

## Status

Accepted in PS-456.

## Intended design

Codex should acknowledge that it accepted an answer for a specific native question. The harness should resolve the live reply only after that acknowledgement. A cleared request must report an error instead of success.

## External limitation

The [app-server protocol](https://learn.chatgpt.com/docs/app-server#toolrequestuserinput) emits the same `serverRequest/resolved` notification when a client responds and when a turn clears a request. It does not distinguish accepted answers from cleanup. Native probes on Codex 0.139.0 and 0.159.3 also show no completed question item containing the accepted answers. The resolved event can arrive before the provider records the answer.

A clean protocol-only confirmation is currently impossible. Treating request cleanup as delivery would falsely tell the user that Codex received an answer.

## Temporary workaround

The Codex extension reads the native transcript at the path returned by `thread/start` or `thread/resume`. While a submitted reply is awaiting confirmation, it checks for a `response_item` / `function_call_output` with the same call ID and matching answers by question ID. Only that provider output confirms delivery. A different output fails the reply.

Checks run only while an answer is awaiting confirmation. At cancellation, protocol closure, or turn completion, stop checking and read once more before rejecting any unconfirmed reply and releasing the process. This permits normal persistence after the resolved event without leaving an ended run waiting forever.

This adds file reads and depends on Codex's native transcript format. It is isolated to the Codex question confirmation helper. The host sees only the existing live reply contract. It adds no database fields, stored state, or parsing of assistant text.

## Removal

When the supported app-server protocol provides a correlated accepted-answer event or response, verify its acceptance and cleanup behavior on the supported Codex versions. Replace the transcript confirmation helper with that event. Remove the file checks and retain tests for delayed acceptance, cleared requests, mismatched answers, cancellation, and process closure.
