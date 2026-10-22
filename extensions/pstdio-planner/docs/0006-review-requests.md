# Needs attention

**Needs attention** is the place for ticket actions that need a person. It currently contains review requests: tasks and decisions that ask for input on a ticket. Other agent actions can use this area as they are added.

Planner owns every review request: attempt handoffs, timeline tasks, and decisions all use the same commands and storage. The numbered **Needs attention** bubble counts open or unreadable requests.

"Review" here means a person's answer. Code reviews of an attempt use `run-review` and `submit-review` instead. See [Attempts](0002-attempts.md).

## Kinds of requests

- A **task** asks a person to do something and confirm it. Its response is `{"confirmed":true}`.
- A **decision** asks one or more questions. Each question takes text, one choice, or several choices. Its response is `{"answers":{"<question-id>":"<answer>"}}`. A text or single-choice answer is a string. A multiple-choice answer is an array of choice IDs.

Planner checks every response before it saves it. Required answers must be present. Unknown questions, unknown choices, duplicate choices, and wrong value types are refused.

Attempt handoffs ask one required text question with the ID `result`. Its answer describes the decision and the action that was completed.

## Lifecycle

1. `request-human` saves the request and updates the Needs attention count. It does not start or continue an agent session.
2. A person or an agent answers with `review` or cancels with `review-requests cancel`. Schedules, automations, and event handlers cannot do either.
3. Each request has one current outcome: an answer or a cancellation. If the first answer races another answer or cancellation, the first write wins and the other caller sees the saved outcome.
4. When no open request is left on the ticket, the bubble shows the resolved count. Planner does not change the ticket status; the implementation agent updates it when it continues.

The request title, instructions, questions, and workflow context do not change after they are saved. To correct them, cancel the request and create a new one. Answers to one request never close another open request.

Choose **Open session** when you want to discuss a request with an agent. The first click starts a conversation or resumes the related session when it owns the ticket or attempt. Later clicks reopen that conversation without sending another prompt. You can answer the form without opening a conversation. The request's session link stays empty until you open it.

Decision forms stay editable after submission, with saved choices and text filled in. Change the answers and choose **Update answer** to save a revision. The same `review` command updates a saved decision from the CLI. Each revision is validated and replaces the current answer; when revisions race, the last saved revision is current. The request stays answered, so revising it does not pause work again. Cancelled requests stay closed. Task confirmations stay completed.

Saving a response records what the person decided. It does not merge, select an attempt, recover a session, or finish the ticket. Use the matching Planner command for that. Opening a request's chat does not record a response either.

Revising an answer does not undo actions already taken using the earlier answer. Open the linked chat if the agent needs to change ongoing work.

New requests need a ticket that is not done. Answers and cancellations still work after the ticket is done, because a merge can finish the ticket before its approval request is answered. Deleting a ticket deletes its requests.

Answering or cancelling the last open request resolves pending input when no unreadable record remains. Board cards with pending input open the ticket's **Needs attention** page directly. The ticket sidebar stays beside the forms, so the ticket body is one click away. The forms use the same question controls as questions an agent asks in chat: one step tab per question, with radio buttons or checkboxes for choices. Generic UI and CLI tag edits cannot create a false blocker or hide a real request.

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

Legacy free-text requests in `planner-human-requests` are not inferred as actionable requests. Inspect the ticket for an actual outstanding task or decision. If one exists, create a structured request with concrete instructions and questions. Otherwise no human input is needed.

Board, CLI, and timeline reads derive pending input and counts from current requests, including on archived and completed tickets. Request changes refresh readers without rewriting ticket tags. The storage upgrade removes the old Needs attention tag option and its ticket references, while preserving custom flag options and request history.

Unreadable request or outcome records remain visible and keep work paused. Ask your project maintainer to restore the named record and its outcome from a known-good backup through the public extension storage API, then reopen the ticket. Reconciliation does not delete or mark a broken record as answered.
