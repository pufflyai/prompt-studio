# Live channel

The project owns one `createLiveConnection` (`pstdio-sync/relay`), shared by document owners,
stream readers and procedure handlers. See [ADR 0130](../../adrs/0130-route-live-traffic-by-topic-and-device.md).
The durable [HTTP sync protocol](0029-blind-relay.md) remains version 1.

## Connect and restore

Connect to `/sync/projects/~<project>/live` with the usual bearer token,
`pstdio-sync-protocol: 1` and `pstdio-live-protocol: 2`. An absent or unsupported live version
gets HTTP 426 with `protocol-unsupported`, supported live versions and an update message.
After a refused handshake, the client probes the authenticated HTTP refusal once to classify a
version error, stops reconnecting and exposes `protocolUnsupported`. The account API returns
an actionable update error through the existing project-opening error display. No new screen
or layout is introduced.

The server sends `{type: "ready", protocolVersion: 2}` before accepting live work.

There is one active connection per authenticated device and project; a replacement closes its
predecessor. The client restores subscriptions, followers, discovery and registrations after
ready. It reads documents again to recover missed notices. Access renewal reconnects immediately;
network failures use the existing increasing reconnect delay. Reader state resets to false on
any disconnect, including renewal. No old payload or call is replayed.

All IDs use the existing bounded identity schemas. Topics and procedures are opaque sync IDs
(16–128 URL-safe characters), derived with `space.documentId()` and distinct names for streams
and procedures. Documents use their own document IDs as topics. Every topic operation includes
`spaceOwner` (`null` for project data, account ID for private data). Authorization checks apply
on each operation, and the same topic bytes in different spaces or projects stay separate.

## Topics and reader state

Client messages:

| Type | Other fields | Effect |
| --- | --- | --- |
| `subscribe`, `unsubscribe` | `spaceOwner`, `topic` | Join or leave a topic |
| `publish` | `spaceOwner`, `topic`, base64 `payload` | Send opaque encrypted bytes to current subscribers other than the sender |
| `follow`, `unfollow` | `spaceOwner`, `topic` | Follow remote reader state or stop following |
| `discover`, `undiscover` | `spaceOwner` | Join or leave the reserved new-documents control topic for that space |

`follow` always answers with `{type: "subscribers", spaceOwner, topic, active}`. Subsequent
messages arrive only when remote readership changes between zero and nonzero. A device's own
subscriptions do not count as remote readers. Close and expiry remove all of its routing state.
`createLiveConnection.follow()` initializes readers to false. Build and send streaming text only
while it reports true; no heartbeat is required. Multiple local readers share a reference-counted
subscription. `sealLive` and `openLive` bind ciphertext to the sender, space and topic.

Publications arrive as `{type: "event", spaceOwner, topic, deviceId, payload}`. A committed
update or latest state sends `{type: "changed", spaceOwner, documentId, lastSequence, stateId}`
only to that document's subscribers. The first committed content also sends `discovered` with
the same metadata to discovery subscribers that do not already subscribe to the document.
Retries and later writes do not generate discovery events. Discovery is an ephemeral hint,
not a stored directory: encrypted owner metadata discovers document names during catch-up.

The application owns its shared channel in `startRelayRuntime`. Each sync owner has a separate
drain, cancellation signal and status. A document failure retries only that owner with an increasing
delay; it never reconnects healthy owners. `createDocumentRelay` subscribes through the owner's
`subscribe` callback before reading. Ordinary changes wake only matching owners; discovery can
wake owners to read their encrypted directory. PS-1014 owns finer session sync cost and reader
integration; this protocol supplies the events it needs.

## Calls

A callee sends `register` or `unregister` with `spaceOwner` and opaque `procedure`.
A caller sends `call` with `id`, `spaceOwner`, `deviceId` (destination), `procedure` and encrypted
base64 `payload`. IDs are unique among that caller connection's pending calls. An absent device
or registration returns `{type: "call-error", id, error: "unavailable"}` immediately.

The callee receives `invocation` with a relay-generated `id`, the authenticated caller's
`deviceId`, `spaceOwner`, `procedure` and unchanged `payload`. Relay invocation IDs prevent
collisions between callers and cross-connection replies. Only the selected callee may answer.
The callee sends `result` with that invocation ID, `payload` and `done` (false for partial results,
true for completion), or `call-error` with `failed`. The caller receives its original ID and the
callee's device ID on results. Client `call()` resolves with the final payload and sends partials
to its callback.

The caller sends `cancel` with its original ID. The callee receives `cancelled` with the
invocation ID; the caller receives a `cancelled` error. Disconnecting either side ends pending
calls with `disconnected` for the remaining side. Late replies after cancellation are ignored.
`limit-exceeded` refuses a call when either participant reaches its active-call limit.
`register()` handlers receive an abort signal and a partial-result sender. Cancellation prevents
further results from reaching the socket; handlers must stop their own work when aborted.

Remote procedure owners must seal calls with `sealDeviceCall` and open them with `openDeviceCall`
before executing a command. The callee resolves the caller's trusted Ed25519 public key from its
authenticated device directory, never from the received payload. The encrypted signature binds
the project, space, caller, destination, procedure and command bytes. This channel does not enroll
device signing keys or implement remote commands; PS-827 owns those behaviors and command replay
protection. Raw `call()` transports ciphertext and cannot authenticate command semantics itself.

## Delivery and limits

Delivery is at most once, ordered by WebSocket arrival for a sender and topic. There is no
retention, subscription snapshot of payloads, durable call state or offline queue. Router state
contains connection references, bounded IDs and flags, never payloads. Nothing uses relay storage.
A slow socket (`send` returns zero or less) closes with 1013. Reconnect and read documents.

Malformed messages and unauthorized private spaces close with 1008. Oversized messages close
with 1009. Rate or routing-state limits close with 1013. Operator defaults are 64 KiB decoded
payload, 4096 combined topic subscriptions/followers/discovery/registrations, and 128 active calls
per connection. Existing per-device rate limits also apply to control messages. Restore bounded
subscriptions within that rate. No per-topic polling or timers run on an idle channel.

Routing runs inside one relay process. Several processes will require a forwarding layer while
preserving these project, space and device boundaries.
