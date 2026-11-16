# Temporary Codex LF framing

Proposed: 2026-11-15
Status: Accepted. Temporary workaround for Bun 1.4.4's `node:readline` splitting Unicode separators inside valid JSON strings.

## Ideal design

Read Codex app-server JSON messages at their LF delimiters. Unicode line and paragraph separators inside text remain message content, including when their UTF-8 bytes cross stream chunks. Drain final output before reporting EOF.

## External limitation

Bun 1.4.4's `node:readline` also splits at U+2028 and U+2029. A saved Figma tool result containing U+2028 split a valid `thread/read` response into malformed JSON fragments. The RPC reader discarded them and left the request unresolved. Node's reader preserves the same JSON message.

## Decision

Keep LF framing in the Codex RPC adapter. Decode chunks with `StringDecoder`, split only at LF, and flush the last partial line at EOF. Keep decoded fragments, scan each chunk once, and join only at LF or EOF so fragmented histories load in linear work. Existing JSON parsing accepts CRLF whitespace. No stored history, public API, connection ownership, or cancellation behavior changes.

## Limitations

The adapter owns a small decoder and partial-line buffer until Bun can provide the required framing. It retains the existing behavior for malformed JSON and does not introduce an arbitrary transcript-size limit.

## Removal

When upgrading Bun, run the Unicode separator regression against `node:readline`. Restore the built-in reader only when both separators, split UTF-8, response/notification ordering, and EOF coverage pass. Remove this ADR with that change.

## Evidence

- [RPC framing and EOF regressions](../../extensions/harness-codex/src/app-server-rpc.p0.test.ts)
- [RPC reader](../../extensions/harness-codex/src/app-server-rpc.ts)
