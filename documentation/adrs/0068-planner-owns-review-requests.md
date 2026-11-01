# Planner owns review requests

Proposed: 2026-10-10

Status: Accepted for PS-579. Implemented in the PS-545 timeline pull request.

## Context

Planner already asked people for input during attempts. It saved a request, linked a chat session, and set the Review Needed flag. The ticket timeline then added its own task and decision requests with separate collections, validators, commands, and attention rules.

The two systems decided independently whether a ticket needed a person. Answering a timeline task hid an unrelated open Planner request: the timeline treated "some request was answered" as "the Review Needed flag is satisfied". The cause was split ownership of one rule.

## Decision

Planner owns every review request. The timeline renders and answers the same requests through the same commands as the CLI and the attempt workflows.

- A request holds the title, instructions, a task or decision body, the actor who asked, and its context: workflow reason, workspace, attempt revision, and linked session. Its content and workflow context are immutable. The conversation link is filled only when the person chooses Open session.
- Creating a request does not create or continue an agent session. Open session starts or resumes the request conversation on demand, then reopens that saved session on later visits. Answering a form does not require a conversation.
- Each request has one current outcome: an answer or a cancellation. The first outcome is stored in its own collection under the request ID with an atomic `createIfAbsent`, so competing initial answers and cancellations cannot both win. A validated decision revision replaces its existing answer with `update`; it cannot create an outcome after deletion. Concurrent revisions use the last saved answer. Cancelled requests and completed task confirmations stay closed.
- State is derived. A request without an outcome is open. Planner does not store a second state field or a second copy of the response.
- Pending input for a ticket is "any open request, or any unreadable request record". Answers never hide another open request. A manual or stale flag never owns pending input.
- The numbered Needs attention bubble is the user-visible indicator. Planner derives it from current requests. There is no separate attention tag. Automation reads pending requests through the shared readiness commands.
- Attempt status updates and launch readiness check open or unreadable requests directly, including completed and transitive launch prerequisites.
- `review --request-id <id> --response <JSON>` answers a request. `review-requests` read, list, cancel, and open complete the command set. `resolve-human-request` and the timeline's `timeline.action.*` commands are removed.
- Saving a response records a decision. It does not merge, select an attempt, or finish a ticket.
- Decision forms stay editable and restore their saved choices and text. Updating an answer keeps the request answered and does not undo actions taken using an earlier answer. The linked chat is available for changes to ongoing work.
- New requests need a ticket that is not done. Answers and cancellations only need the ticket to exist, so a request stays closable after a merge marks its ticket done.
- Settling the last open request resolves pending input when no unreadable records remain. Generic tag writes do not affect requests.

Code-review attempts, review threads, and agent review gates stay separate. They share the word "review" but not this lifecycle.

## Alternatives

- Keep both systems and synchronize them. Rejected: two owners for one rule, and the result depends on the order of updates.
- Keep only free-text requests. Rejected: tasks and choice questions are product requirements.
- Move requests into the host. Rejected: this is Planner domain behavior, and the public storage, session, and event APIs already cover it.

## Consequences

The first outcome insert is atomic, and decision revisions replace that same record, so a request has one current outcome. The extension storage API replaces a whole collection item when updating it. A separate flag synchronization would therefore risk overwriting a concurrent ticket edit.

Planner limits the effect without a workaround:

- Request changes write only request and outcome records and emit a ticket refresh event. They do not replace a ticket to synchronize its display flag.
- Board, ticket, CLI, and timeline reads derive counts and pending input from current requests. Attempt status updates and launch readiness read requests directly. Automation extensions must use the shared `attempt-readiness` and `run-attempt` commands.

No write claim is needed, so this decision adds no temporary workaround.

Old request records are not migrated. The user waived migration for this alpha change. New records use the new `planner-review-requests` and `planner-review-request-outcomes` collections, so the old `planner-human-requests` records are never read. Reading them would turn every resolved old request into a permanent read error, and read errors count as pending input. Legacy flags alone never block work. PS-709 removes the obsolete attention option and its ticket references in the storage upgrade, while preserving custom flag options and request records. A real unresolved legacy question must be inspected and turned into a concrete structured request; a tag or old free text never invents a request.

`review` sits next to the code-review commands in the CLI. Its help text and the Planner docs say that it answers a human request.
