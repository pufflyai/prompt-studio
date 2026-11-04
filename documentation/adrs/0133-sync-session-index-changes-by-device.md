# Cloud sync work follows what changed, not the project's size

Proposed: 2026-11-01

Status: Accepted

Builds on [message logs](0131-personal-session-message-logs.md) and the [live channel](0130-route-live-traffic-by-topic-and-device.md). Supersedes ADR 0131’s whole-index CRDT and shared preview topic decisions. Uses the same encrypted update envelopes and atomic local page cursors as the message logs.

## Context

Each device syncs a Cloud project through several owners: core project documents, published extensions, automations, each enabled extension, and session history. Measured on the real relay stack, the PS-1009 prototype cost 24–30% of a CPU core on each device while three sessions streamed, against 3% with Cloud off (the PS-1014 research attachment):

- **Socket fan-out.** Each owner had its own live socket. Every change notice woke every owner, and every finished pass reread the whole project's sync status.
- **Repeated bookkeeping.** Sync code reread unchanged state many times a second: the login file, the environment row and the session index.
- **Unread previews.** Streaming previews went to every device whether or not anyone was reading them.
- **One document for the whole index.** The session index is one CRDT document. Each sync encodes and clones it whole, so its cost grows with every session the project has ever had.

## Decision

1. **One live connection per project on each device.**
   - The relay runtime owns the connection, and every owner attaches to it.
   - Each owner subscribes to the topics of the documents it syncs, so the relay sends a change notice only to devices and owners that sync that document (PS-1018).
   - Owners also follow their space's new-documents topic, so they still find documents created on another device.
   - Each owner runs and retries its own sync. A failing owner does not reconnect the others.
   - Access renewal and reconnects happen once per project. Owners retain a catch-up pass after renewal because changes can arrive during the socket replacement. Each owner filters notices by its own document IDs.
2. **Streaming previews go only to sessions someone reads.**
   - Each session has a preview topic. A device that shows another device's session subscribes to it and unsubscribes when it closes the session.
   - The running device follows the subscribers of its sessions' preview topics (PS-1018). It builds and sends previews only while a topic has subscribers.
   - The relay sends previews only to subscribers, so a device that is not reading receives none.
3. **Each device publishes its part of the session index as its own append-only log.**
   - Only the device that runs a session writes that session's rows. A follow-up sent from another device is a remote command (PS-827), and the running device writes the result. So every row has one writer.
   - Each entry adds, changes or removes one session, workspace or link row, or moves a log's head. A capture appends only the rows that changed.
   - Other devices read new entries from their cursor and apply them to a local table. Each device writes snapshots of its own log, so a new device does not replay its whole history.
   - It uses the PS-1009 log format. There is no CRDT and nothing to merge, and nothing encodes or clones the whole index.
4. **Sync bookkeeping reads from memory.**
   - Parsed index rows and the environment ID are kept until storage reports a change.
   - The device name is fetched once per login. A small personal CRDT directory contains device IDs only, so a new device can discover every index log.
5. **Finishing a run does not re-check the whole conversation.**
   - While a run streams, the publisher compares messages as they complete.
   - When the run ends, it fingerprints only the messages it has not compared yet.
   - It reloads the conversation only after a restart, and only when the session changed since its last publish.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep one socket per owner and filter notices per socket | The relay still sends every notice to every socket, and each socket still renews and reconnects on its own. A prototype with this filter still cost 9% and 6% of a core. |
| Sync the index as records through the record stream (ADR 0102) | Each record would still be a CRDT, with an outbox, compaction and record adoption, for rows that only one device writes. |
| Keep the index as one CRDT document and make its sync cheaper (no clone per merge) | It needs a change to the shared document-sync merge, which every document uses. The cost would still grow with the number of sessions. |
| Readers repeat an encrypted watching signal every 10 s; senders stop 15 s after the last one (the PS-1009 prototype) | A new reader can wait up to 10 s for text, previews flow 15 s after the reader leaves, and every device still receives every signal. |
| Keep forwarding every notice and let each device drop the ones for documents it does not claim (the PS-1009 prototype) | Every device still receives and decrypts every notice, and a notice for an unclaimed document wakes every owner of its space. |
| Throttle previews to once a second | It halves the cost but keeps it on every device, and it doubles the lag for readers. |

## Consequences

- A device's sync work follows the documents and rows that changed, not the number of owners, sessions or devices.
- A device that is not reading another device's session receives no streaming text. A reader sees text from the next preview, on the next 250 ms preview tick after the relay tells the running device it subscribed.
- The session index changes format. Each device publishes its rows once in its new log. As in PS-1009, the old index document is not migrated.
- A session's rows stay with the device that runs it. Moving a session to another device would need a different index; PRD 0014 R40 rules that out.
- A new document's notice reaches every owner that follows its space's new-documents topic. This happens once per document.
- Decisions 1 and 2 need the relay changes in PS-1018.

## Validation

Regression tests cover incremental rows, deletion, durable cursor restart, private queue records, account switches, key renewal, and immediate reader presence. The CPU diagnostic uses two separate API processes, 2,003 saved sessions, 25 extension owners, and an owned relay/PostgreSQL/object-store deployment. Its default one-hour phases match the sustained CPU scenarios; shorter runs report their duration and do not establish the one-hour targets.
