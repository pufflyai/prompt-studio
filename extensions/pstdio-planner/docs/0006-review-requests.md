# Review requests

A review request asks a person for input on a ticket. Planner owns every request: attempt handoffs, timeline tasks, and decisions all use the same commands and storage. The **Review Needed** flag stays on while any request on the ticket is open.

"Review" here means a person's answer. Code reviews of an attempt use `run-review` and `submit-review` instead. See [Attempts](0002-attempts.md).

## Kinds of requests

- A **task** asks a person to do something and confirm it. Its response is `{"confirmed":true}`.
- A **decision** asks one or more questions. Each question takes text, one choice, or several choices. Its response is `{"answers":{"<question-id>":"<answer>"}}`. A text or single-choice answer is a string. A multiple-choice answer is an array of choice IDs.

Planner checks every response before it saves it. Required answers must be present. Unknown questions, unknown choices, duplicate choices, and wrong value types are refused.

Attempt handoffs ask one required text question with the ID `result`. Its answer describes the decision and the action that was completed.

## Lifecycle

1. `request-human` saves the request, links a chat session, and sets Review Needed. A request from an attempt reuses the attempt's session when that session owns the work. Otherwise Planner starts a new chat for the ticket.
2. A person or an agent answers with `review` or cancels with `review-requests cancel`. Schedules, automations, and event handlers cannot do either.
3. Each request gets exactly one outcome: an answer or a cancellation. If two answers race, the first one wins and the other caller sees the saved outcome.
4. When no open request is left on the ticket, Planner clears Review Needed.

Requests do not change after they are saved. To correct one, cancel it and create a new request. Answers to one request never close another open request.

Saving a response records what the person decided. It does not merge, select an attempt, recover a session, or finish the ticket. Use the matching Planner command for that. Opening a request's chat does not record a response either.

New requests need a ticket that is not done. Answers and cancellations still work after the ticket is done, because a merge can finish the ticket before its approval request is answered. Deleting a ticket deletes its requests.

Answering or cancelling the last open request clears Review Needed, including a flag a person set by hand.

## CLI

```sh
pst pstdio-planner request-human --ticket PS-32 --title 'Check the preview' --instructions 'Open the preview and confirm its layout.' --request '{"kind":"task"}'
pst pstdio-planner review --request-id <id> --response '{"confirmed":true}'
```

A decision with a choice and a text question:

```sh
pst pstdio-planner request-human --ticket PS-32 --title 'Choose the release scope' --instructions 'Choose the scope and describe any limits.' --request '{"kind":"decision","questions":[{"id":"scope","label":"Release scope","required":true,"input":{"kind":"single-choice","options":[{"id":"preview","label":"Preview"},{"id":"full","label":"Full release"}]}},{"id":"limits","label":"Limits","required":false,"input":{"kind":"text"}}]}'
pst pstdio-planner review --request-id <id> --response '{"answers":{"scope":"preview","limits":"Use the internal project first."}}'
```

Read, cancel, or open requests:

```sh
pst pstdio-planner review-requests list --ticket PS-32 --open-only
pst pstdio-planner review-requests read --request-id <id>
pst pstdio-planner review-requests cancel --request-id <id> --reason 'The release scope changed.'
pst pstdio-planner review-requests open --request-id <id>
```

Each read returns the request with its derived `state` (`open`, `answered`, or `cancelled`), its `outcome`, and an `outcomeText` summary.

## Storage

Requests live in the `planner-review-requests` collection. Outcomes live in `planner-review-request-outcomes`, one per request, under the request ID. A request without an outcome is open. The design is recorded in [ADR 0068](../../../documentation/adrs/0068-planner-owns-review-requests.md).

Requests saved by Planner 0.42 and earlier stay in `planner-human-requests` and are not read or migrated. If such a request was still open, clear its Review Needed flag on the ticket by hand.
