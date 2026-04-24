---
layout: ../../../layouts/docs-layout.astro
title: Follow up on a session
description: Send new instructions to a completed session and chain work across sessions.
htmlTitle: Follow up on a session
htmlDescription: Send new instructions to a finished agent session, or chain a follow-up session into the same workspace.
section: Guide
category: Daily Workflow
categoryOrder: 3
order: 5
---

## Send a follow-up

Once a session is `completed`, `awaiting_input`, or `failed`, you can send a follow-up message. The follow-up creates a new session that continues the conversation:

### Dashboard

Use the chat panel at the bottom of the session view. Type your message and press enter.

### CLI

```bash
pstdio sessions follow-up \
  --id <session-id> \
  --prompt "Tighten the error handling around the new endpoint."
```

### SDK

```ts
import { createClient } from "@pstdio/sdk/client";
const client = createClient();

await client.sessions.followUp(sessionId, {
  content: "Tighten the error handling around the new endpoint.",
});
```

## Use a prompt template

```bash
pstdio sessions follow-up \
  --id <session-id> \
  --template review-followup \
  --var reviewer=alex --var area=api
```

`--template` and `--prompt` are mutually exclusive.

## Summarize another session

When you want to bring context from a sibling session (for example another attempt on the same ticket), summarize it into the follow-up:

```bash
pstdio sessions follow-up \
  --id <session-id> \
  --summary-of <other-session-id> \
  --summary-format detailed \
  --summary-role assistant \
  --prompt "Apply the approach from the summary."
```

Options:

- **`--summary-format brief | detailed`** — how much detail to include.
- **`--summary-role assistant | all`** — which roles to pull from the source session.

## Switch agent or model mid-thread

Follow-ups can change the agent or the model:

```bash
pstdio sessions follow-up \
  --id <session-id> \
  --agent opencode \
  --model gpt-5 \
  --prompt "Retry with a cheaper model now that the plan is settled."
```

## Approvals during follow-up

If the follow-up hits a tool that requires approval, the session transitions to `awaiting_input`. Approve or deny:

```bash
pstdio sessions approve --id <session-id> --approval-id <approval-id>
pstdio sessions deny    --id <session-id> --approval-id <approval-id>
```

## Related pages

- [`pstdio sessions` reference](/docs/reference/cli/sessions/) — CLI options.
- [`client.sessions` SDK reference](/docs/reference/sdk/client/#clientsessions).
