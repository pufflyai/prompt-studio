# Needs attention

**Needs attention** collects decisions a person needs to make. Use a request only for an unresolved choice that the agent cannot settle from existing instructions or authority.

Identify the ticket in the title and keep request text to at most 80 words, excluding document links. Prefer **Problem**, **Solution**, and **Downside**, with one short sentence per part; use another structure when it makes the decision clearer. Include each choice’s main cost and a marked recommendation. Keep question and option labels short, without repeating the summary.

Use descriptive Markdown links to relevant documents or exact sections, such as the proposal, ADR, design, or report. Include as many relevant links as needed. Reuse existing documents and link evidence, background, and implementation detail instead of copying them into the request. The choice and essential trade-offs should be clear without opening the links.

Missing resources, credentials, access, reproduction details and non-decision actions use **Blocked** and a specific blocked reason: what is missing and what allows work to continue. Clear the reason when resolved. Dependency waiting belongs in dependency links. Routine assumptions, risk checklists and handing in work do not by themselves need a request.

Planner owns the saved requests and answers used by Auto Build, card and milestone modals, and the ticket page. The numbered **Needs attention** bubble counts open or unreadable requests. “Review” here means a person's answer. Code reviews use `run-review` and `submit-review`; see [Attempts](0002-attempts.md).

## Request forms

A **decision** asks one or more questions using text, one choice, or several choices. Its response is `{"answers":{"<question-id>":"<answer>"}}`. A text or single-choice answer is a string; multiple-choice answers are arrays of choice IDs. Required answers must be present. Unknown questions, unknown choices, duplicates and wrong value types are refused.

Previously saved task confirmations and handoffs remain readable and answerable. A task response is `{"confirmed":true}`. The task API remains available for existing integrations; new agent guidance reserves requests for decisions.

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

Answering or cancelling the last open request resolves pending input when no unreadable record remains. In Project Timeline, only a card’s Needs attention bubble opens that ticket’s forms in a modal. The milestone’s bubble opens the same modal for requests from its tickets, with each request labeled by ticket. Closing it restores focus to the activating bubble. Clicking the rest of the card keeps its normal ticket preview behavior. Tickets board attention counts continue to open the Side Panel. Auto Build shows warnings first, then its current work’s requests inline, Supervisor, and Agents. Previous and Next show one pending request and its position, preserving each draft. Saving removes the resolved item and selects the next; a failed save preserves the draft and shows an inline error. A single request has no carousel controls. The ticket sidebar's **Needs attention** entry still opens the full page beside the ticket navigation. Both surfaces use the same question controls as questions an agent asks in chat: one step tab per question, with radio buttons or checkboxes for choices. Generic UI and CLI tag edits cannot create a false blocker or hide a real request.

## CLI

```sh
pst pstdio-planner request-human --ticket PS-32 \
  --title 'PS-32 · Choose when dependent work starts' \
  --instructions '**Problem:** Dependent work needs a starting point.

**Solution:** Wait for prerequisite merges (recommended), or start from submitted revisions.

**Downside:** Waiting delays work; starting early may require integration repairs.

**Details:** [Dependency policy](https://prompt.studio/docs/extensions/planner/auto-build/#start-auto-build).' \
  --request '{"kind":"decision","questions":[{"id":"start","label":"When should dependent work start?","required":true,"input":{"kind":"single-choice","options":[{"id":"merged","label":"After prerequisites merge (recommended)"},{"id":"submitted","label":"After prerequisites submit work"}]}}]}'
pst pstdio-planner review --request-id <id> --response '{"answers":{"start":"merged"}}'
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

Legacy free-text requests in `planner-human-requests` are not inferred as actionable requests. Inspect the ticket for a genuine unresolved decision. If one exists, create a structured request with concrete instructions and questions. Otherwise no human input is needed.

Board, CLI, and timeline reads derive pending input and counts from current requests, including on archived and completed tickets. Request changes refresh readers without rewriting ticket tags. The storage upgrade removes the old Needs attention tag option and its ticket references, while preserving custom flag options and request history.

Unreadable request or outcome records remain visible and keep work paused. Ask your project maintainer to restore the named record and its outcome from a known-good backup through the public extension storage API, then reopen the ticket. Reconciliation does not delete or mark a broken record as answered.
