# The relay's live channel routes by topic and device

Proposed: 2026-11-01

Status: Accepted for implementation.

This changes how the relay forwards live traffic under PRD 0014 R31–R33. Storage and the HTTP sync protocol stay at version 1. See the [live protocol](../references/architecture/0030-live-channel.md).

## Context

The relay sends every live message and change notice to every device of a project ([blind relay](../references/architecture/0029-blind-relay.md)). Clients filter what they don't need, and a device that sends streaming text cannot tell whether anyone reads it. Remote commands need calls to one device that fail at once when it is offline (R32). No existing protocol covers these needs with libraries we can run inside the relay.

## Decision

The live channel uses our own versioned protocol on the relay's existing WebSocket. It follows WAMP's model for topics and calls and NATS's immediate error for a call nobody can answer.

1. **One connection per project on each device.** Every part of sync on the device shares it (PS-1014 decision 1).
2. **Topics.**
   - A topic is an opaque ID that the client derives with the space's key, like a document ID. Each topic belongs to one space: the project, or one user's private space.
   - The relay checks the device's access to the space on every subscribe and publish. Private topics reach only their owner's devices (R26).
3. **Subscribe, unsubscribe and publish.**
   - A device subscribes to the topics it wants and unsubscribes when it no longer does. Closing the connection ends all of its subscriptions.
   - The relay delivers a publish to the topic's current subscribers, other than the sender. Nothing is kept for later subscribers.
4. **Subscriber events.**
   - A device can ask to follow a topic's subscribers. The relay then tells it when the topic gets its first subscriber and when it loses its last one, and on request answers with the current state.
   - This replaces the watching signal: a device builds streaming text only for topics that have subscribers.
5. **Change notices are topic events.**
   - Each synced document has a topic. When the relay stores an update or latest state, it sends the notice to that topic's subscribers.
   - Each space has a reserved new-documents control topic (`discover`). The relay sends a notice there when a document gets its first update, so a device finds documents it does not sync yet.
   - This replaces client-side document claims.
6. **Calls to one device.**
   - A device registers the procedures it answers. A call names the target device and procedure.
   - If the device is not connected or did not register the procedure, the relay answers with an error at once. Nothing is queued (R32).
   - The callee can send partial results before the final one, and the caller can cancel. If either side disconnects, the other gets an error.
   - The payload carries the caller's device signature, which the callee checks (R33). `sealDeviceCall` and `openDeviceCall` bind it to the project, space, caller, destination and procedure. Procedure owners supply trusted device keys; PS-827 owns remote-command identity enrollment and command handlers. The relay routes calls and reads nothing.
7. **Delivery.** At most once, in order per sender and topic. A connection that cannot keep up is closed, as today; on reconnect the device subscribes again and reads documents.
8. **State on the relay.** Subscriptions, subscriber followers and registrations live in memory per connection. After a relay restart, devices reconnect and subscribe again; a sender treats every topic as unread until the relay says otherwise.
9. **Versions and limits.** The channel has its own protocol version, checked on connect (R29). The relay limits subscriptions per connection, message size and message rate.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep forwarding everything and filter on the client (the PS-1009 prototype) | Every device still receives and decrypts traffic it drops. The watching signal adds up to 10 s before a reader sees text and 15 s of unread previews after. |
| MQTT 5 | No subscriber events for senders, and a call to an offline device can only time out. |
| NATS | No subscriber events for ordinary clients, so the watching signal stays. Adds a server to deploy and a second token system. Worth reconsidering for traffic between relay processes. |
| WAMP as the wire protocol | Its model fits, but its libraries are barely maintained, so we would write our own router and client anyway. |
| Centrifugo | Calls go to a backend, not to another device. |

## Consequences

- A device receives only what it subscribed to, and sends streaming text only while someone reads it.
- The relay learns which device subscribes to which opaque topic, and when. It already sees which documents a device reads, so it learns no content.
- A relay restart pauses streaming text until devices subscribe again.
- Devices on earlier releases cannot use the new channel; the version check tells them to update.
- Several relay processes need forwarding between them later; the protocol does not change for that.
