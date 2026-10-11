# Planner owns review requests

Proposed: 2026-10-10

## Status

Accepted for PS-579. Implemented in the PS-545 timeline pull request.

## Context

Planner already asked people for input during attempts. It saved a request, linked a chat session, and set the Review Needed flag. The ticket timeline then added its own task and decision requests with separate collections, validators, commands, and attention rules.

The two systems decided independently whether a ticket needed a person. Answering a timeline task hid an unrelated open Planner request: the timeline treated "some request was answered" as "the Review Needed flag is satisfied". The cause was split ownership of one rule.

## Decision

Planner owns every review request. The timeline renders and answers the same requests through the same commands as the CLI and the attempt workflows.

- A request is immutable. It holds the title, instructions, a task or decision body, the actor who asked, and its context: workflow reason, workspace, attempt revision, and linked session.
- Each request has at most one outcome: an answer or a cancellation. The outcome is stored in its own collection under the request ID with an atomic `createIfAbsent`, so competing writers cannot both win.
- State is derived. A request without an outcome is open. Planner does not store a second state field or a second copy of the response.
- Pending input for a ticket is "any open request, or any unreadable request record". Answers never hide another open request or an explicit Review Needed flag.
- Review Needed stays the user-visible flag and the signal automation extensions read. Planner rewrites it from the stored requests after every request change. It is a projection of request state, not a second lifecycle.
- Attempt status updates check open requests as well as the flag.
- `review --request-id <id> --response <JSON>` answers a request. `review-requests` read, list, cancel, and open complete the command set. `resolve-human-request` and the timeline's `timeline.action.*` commands are removed.
- Saving a response records a decision. It does not merge, select an attempt, or finish a ticket.
- New requests need a ticket that is not done. Answers and cancellations only need the ticket to exist, so a request stays closable after a merge marks its ticket done.
- Settling the last open request clears Review Needed, including a flag a person set by hand. This keeps the earlier `resolve-human-request` behavior.

Code-review attempts, review threads, and agent review gates stay separate. They share the word "review" but not this lifecycle.

## Alternatives

- Keep both systems and synchronize them. Rejected: two owners for one rule, and the result depends on the order of updates.
- Keep only free-text requests. Rejected: tasks and choice questions are product requirements.
- Move requests into the host. Rejected: this is Planner domain behavior, and the public storage, session, and event APIs already cover it.

## Consequences

The extension storage API has no transaction that spans a request, its outcome, the ticket's flag, and a session. The outcome insert is atomic, so a request can never get two outcomes. The flag write is not atomic with it. A crash, or two request changes on the same ticket at the same time, can leave the flag wrong until the next request change on that ticket. The flag write also replaces the whole ticket record, as other Planner ticket writes do.

Planner limits the effect without a workaround:

- Every request change recomputes the flag from all stored requests, so the next change repairs an earlier interrupted write.
- The timeline and attempt status updates read open requests directly, so a missing flag cannot hide an open request there. The Tickets board and automation extensions read the flag and can see the wrong value until it is repaired.

No write claim is needed, so this decision adds no temporary workaround.

Old request records are not migrated. The user waived migration for this alpha change. New records use the new `planner-review-requests` and `planner-review-request-outcomes` collections, so the old `planner-human-requests` records are never read. Reading them would turn every resolved old request into a permanent read error, and read errors count as pending input. An old open request disappears from the request list; its Review Needed flag stays on the ticket until a person clears it.

`review` sits next to the code-review commands in the CLI. Its help text and the Planner docs say that it answers a human request.
